// Controllers/RegistrationController.js
// Handles new user registration requests

import asyncHandler from 'express-async-handler';
import { sendRegistrationToTelegram } from '../services/telegramService.js';
import StorageService from '../services/storage/StorageService.js';
import RegistrationModel from '../Model/RegistrationModel.js';

/**
 * @desc    Submit a new registration request
 * @route   POST /api/registration/submit
 * @access  Public
 */
const submitRegistration = asyncHandler(async (req, res) => {
  console.log('[Registration] New submission received');

  // Extract form data from request body
  const {
    firstName,
    middleName,
    lastName,
    mobileNumber,
    whatsappNumber,
    email,
    nameAsPerAadhaar,
    aadhaarNumber,
    panNumber,
    permanentAddress,
  } = req.body;

  // Validate required fields
  const requiredFields = {
    firstName: 'First name',
    lastName: 'Last name',
    mobileNumber: 'Mobile number',
    whatsappNumber: 'WhatsApp number',
    email: 'Email',
    nameAsPerAadhaar: 'Name as per Aadhaar',
    aadhaarNumber: 'Aadhaar number',
    panNumber: 'PAN number',
    permanentAddress: 'Permanent address',
  };

  const missingFields = [];
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!req.body[field]) {
      missingFields.push(label);
    }
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`,
    });
  }

  // Validate file uploads
  const files = req.files || {};
  
  if (!files.aadhaarFront) {
    return res.status(400).json({ success: false, message: 'Aadhaar front image is required' });
  }
  if (!files.aadhaarBack) {
    return res.status(400).json({ success: false, message: 'Aadhaar back image is required' });
  }
  if (!files.panCard) {
    return res.status(400).json({ success: false, message: 'PAN card image is required' });
  }

  // Check for duplicate registration
  const existingReg = await RegistrationModel.findOne({
    $or: [
      { aadhaarNumber },
      { panNumber: panNumber.toUpperCase() },
      { mobileNumber },
    ],
    status: { $in: ['pending', 'under_review', 'approved'] }
  });

  if (existingReg) {
    let duplicateField = 'details';
    if (existingReg.aadhaarNumber === aadhaarNumber) duplicateField = 'Aadhaar number';
    else if (existingReg.panNumber === panNumber.toUpperCase()) duplicateField = 'PAN number';
    else if (existingReg.mobileNumber === mobileNumber) duplicateField = 'Mobile number';
    
    return res.status(400).json({
      success: false,
      message: `A registration with this ${duplicateField} already exists.`,
    });
  }

  console.log('[Registration] Form data validated');
  console.log('[Registration] Files received:', Object.keys(files));
  console.log('[Registration] Storage provider:', StorageService.getProvider());

  // ===== UPLOAD DOCUMENTS TO CLOUD STORAGE =====
  const folder = `registrations/${aadhaarNumber}`;
  const uploadedDocs = {};

  try {
    // Upload Aadhaar Front
    const aadhaarFrontResult = await StorageService.upload(
      files.aadhaarFront[0].buffer,
      `aadhaar_front_${aadhaarNumber}.jpg`,
      folder
    );
    if (!aadhaarFrontResult.success) throw new Error('Failed to upload Aadhaar front');
    uploadedDocs.aadhaarFront = { url: aadhaarFrontResult.url, publicId: aadhaarFrontResult.publicId };
    console.log('[Registration] Aadhaar front uploaded');

    // Upload Aadhaar Back
    const aadhaarBackResult = await StorageService.upload(
      files.aadhaarBack[0].buffer,
      `aadhaar_back_${aadhaarNumber}.jpg`,
      folder
    );
    if (!aadhaarBackResult.success) throw new Error('Failed to upload Aadhaar back');
    uploadedDocs.aadhaarBack = { url: aadhaarBackResult.url, publicId: aadhaarBackResult.publicId };
    console.log('[Registration] Aadhaar back uploaded');

    // Upload PAN Card
    const panCardResult = await StorageService.upload(
      files.panCard[0].buffer,
      `pan_${panNumber}.jpg`,
      folder
    );
    if (!panCardResult.success) throw new Error('Failed to upload PAN card');
    uploadedDocs.panCard = { url: panCardResult.url, publicId: panCardResult.publicId };
    console.log('[Registration] PAN card uploaded');

    // Upload Passport Photo (optional)
    if (files.passportPhoto) {
      const passportResult = await StorageService.upload(
        files.passportPhoto[0].buffer,
        `photo_${firstName}_${lastName}.jpg`,
        folder
      );
      if (passportResult.success) {
        uploadedDocs.passportPhoto = { url: passportResult.url, publicId: passportResult.publicId };
        console.log('[Registration] Passport photo uploaded');
      }
    }

  } catch (uploadError) {
    console.error('[Registration] Upload error:', uploadError.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload documents. Please try again.',
      error: uploadError.message,
    });
  }

  // ===== SAVE TO MONGODB =====
  let registration;
  try {
    registration = await RegistrationModel.create({
      firstName,
      middleName: middleName || '',
      lastName,
      mobileNumber,
      whatsappNumber,
      email: email.toLowerCase(),
      nameAsPerAadhaar,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      permanentAddress,
      documents: {
        aadhaarFront: uploadedDocs.aadhaarFront,
        aadhaarBack: uploadedDocs.aadhaarBack,
        panCard: uploadedDocs.panCard,
        passportPhoto: uploadedDocs.passportPhoto || { url: '', publicId: '' },
      },
      status: 'pending',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    console.log('[Registration] Saved to MongoDB:', registration._id);

  } catch (dbError) {
    console.error('[Registration] Database error:', dbError.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save registration. Please try again.',
      error: dbError.message,
    });
  }

  // ===== SEND TO TELEGRAM =====
  const getFileExt = (mimetype) => {
    const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/jpg': 'jpg' };
    return map[mimetype] || 'jpg';
  };

  const telegramFiles = {
    aadhaarFront: files.aadhaarFront ? {
      buffer: files.aadhaarFront[0].buffer,
      ext: getFileExt(files.aadhaarFront[0].mimetype),
    } : null,
    aadhaarBack: files.aadhaarBack ? {
      buffer: files.aadhaarBack[0].buffer,
      ext: getFileExt(files.aadhaarBack[0].mimetype),
    } : null,
    panCard: files.panCard ? {
      buffer: files.panCard[0].buffer,
      ext: getFileExt(files.panCard[0].mimetype),
    } : null,
    passportPhoto: files.passportPhoto ? {
      buffer: files.passportPhoto[0].buffer,
      ext: getFileExt(files.passportPhoto[0].mimetype),
    } : null,
  };

  const telegramResult = await sendRegistrationToTelegram(
    {
      firstName,
      middleName: middleName || '',
      lastName,
      mobileNumber,
      whatsappNumber,
      email,
      nameAsPerAadhaar,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      permanentAddress,
    },
    telegramFiles
  );

  // Update telegram status
  if (telegramResult.success) {
    await RegistrationModel.findByIdAndUpdate(registration._id, {
      telegramSent: true,
      telegramMessageId: telegramResult.messageId?.toString(),
    });
    console.log('[Registration] Telegram notification sent');
  } else {
    console.warn('[Registration] Telegram notification failed:', telegramResult.error);
  }

  console.log('[Registration] ✅ Complete - ID:', registration._id);

  res.status(200).json({
    success: true,
    message: 'Registration submitted successfully! We will review your application and contact you soon.',
    registrationId: registration._id,
  });
});

/**
 * @desc    Get all registrations (for admin panel)
 * @route   GET /api/registration/all
 * @access  Private (Super Broker only)
 */
const getAllRegistrations = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status && status !== 'all') {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const registrations = await RegistrationModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-__v');

  const total = await RegistrationModel.countDocuments(query);

  res.status(200).json({
    success: true,
    registrations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * @desc    Get single registration details
 * @route   GET /api/registration/:id
 * @access  Private (Super Broker only)
 */
const getRegistrationById = asyncHandler(async (req, res) => {
  const registration = await RegistrationModel.findById(req.params.id);

  if (!registration) {
    return res.status(404).json({ success: false, message: 'Registration not found' });
  }

  res.status(200).json({
    success: true,
    registration,
  });
});

/**
 * @desc    Update registration status (approve/reject)
 * @route   PATCH /api/registration/:id/status
 * @access  Private (Super Broker only)
 */
const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const { status, reviewNotes } = req.body;

  if (!['pending', 'under_review', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const registration = await RegistrationModel.findByIdAndUpdate(
    req.params.id,
    {
      status,
      reviewNotes: reviewNotes || '',
      reviewedBy: req.user?._id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!registration) {
    return res.status(404).json({ success: false, message: 'Registration not found' });
  }

  console.log('[Registration] Status updated:', registration._id, '->', status);

  res.status(200).json({
    success: true,
    message: `Registration ${status}`,
    registration,
  });
});

/**
 * @desc    Get registration statistics
 * @route   GET /api/registration/stats
 * @access  Private (Super Broker only)
 */
const getRegistrationStats = asyncHandler(async (req, res) => {
  const stats = await RegistrationModel.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  stats.forEach((s) => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  res.status(200).json({
    success: true,
    stats: result,
  });
});

/**
 * @desc    Delete a registration
 * @route   DELETE /api/registration/:id
 * @access  Private (Admin only)
 */
const deleteRegistration = asyncHandler(async (req, res) => {
  const registration = await RegistrationModel.findById(req.params.id);

  if (!registration) {
    return res.status(404).json({ success: false, message: 'Registration not found' });
  }

  // Optionally delete documents from Cloudinary
  // const { documents } = registration;
  // if (documents?.aadhaarFront?.publicId) await StorageService.remove(documents.aadhaarFront.publicId);
  // ... etc

  await RegistrationModel.findByIdAndDelete(req.params.id);

  console.log('[Registration] Deleted:', req.params.id);

  res.status(200).json({
    success: true,
    message: 'Registration deleted successfully',
  });
});

export { 
  submitRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistrationStatus,
  getRegistrationStats,
  deleteRegistration,
};
