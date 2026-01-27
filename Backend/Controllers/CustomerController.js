// Controllers/CustomerController.js
import asyncHandler from 'express-async-handler';
import CustomerModel from '../Model/CustomerModel.js';
import BrokerModel from '../Model/BrokerModel.js';
import DeletedCustomerModel from '../Model/DeletedCustomerModel.js';
import FundModel from '../Model/FundModel.js';
import OrderModel from '../Model/OrdersModel.js';
import HoldingModel from '../Model/HoldingModel.js';
import PositionsModel from '../Model/PositionsModel.js';
import UserWatchlistModel from '../Model/UserWatchlistModel.js';
import cloudinaryAdapter from '../services/storage/adapters/cloudinaryAdapter.js';

// Utility function to format date (e.g., to YYYY-MM-DD)
const formatDate = (date) => {
  if (!date) return 'N/A';
  // Mongoose standard field: createdAt
  return date.toISOString().split('T')[0];
};

// @desc    Broker adds a new customer
// @route   POST /api/auth/addCustomer
// @access  Private (Broker only, requires token)
const addCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id; // Use _id for consistency
  const { name, password } = req.body; 

  if (!name || !password) {
    res.status(400).json({ success: false, message: 'please enter id and password.' });
    return;
  }

  // Create New Customer - Password stored as plain text
  const newCustomer = await CustomerModel.create({
    name,
    password: password,
    attached_broker_id: brokerIdFromToken, 
    role: 'customer',
  });

  if (newCustomer) {
    res.status(201).json({
      success: true,
      message: 'New Cutomer successfully Added.',
      newCustomer: {
        id: newCustomer.customer_id, // 10-digit Customer ID
        name: newCustomer.name,
        joining_date: formatDate(newCustomer.createdAt), 
        status: 'Active', 
      },
    });
  } else {
    res.status(400).json({ success: false, message: 'Customer data invalid.' });
  }
});


const getBrokerCustomers = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id; // Use _id for consistency

  console.log('[getBrokerCustomers] Broker ID from token:', brokerIdFromToken);
  console.log('[getBrokerCustomers] Broker name:', req.user.name);

  // Debug: Get ALL customers to see what broker IDs they have
  const allCustomers = await CustomerModel.find({}).select('customer_id name attached_broker_id +password');
  console.log('[getBrokerCustomers] ALL customers in DB:', allCustomers.map(c => ({
    id: c.customer_id,
    name: c.name,
    password: c.password,
    attached_broker_id: c.attached_broker_id?.toString()
  })));

  const customers = await CustomerModel
    .find({ attached_broker_id: brokerIdFromToken })
    .select('+password'); 

  console.log('[getBrokerCustomers] Found customers for this broker:', customers);

  const formattedCustomers = customers.map(customer => ({
    id: customer.customer_id,
    name: customer.name,
    password : customer.password,
    joining_date: formatDate(customer.createdAt), 
    status: customer.status || 'Active',
    profile_photo: customer.profile_photo || null,
  }));

  console.log('format cutomer', formattedCustomers)

  res.status(200).json({
    success: true,
    customers: formattedCustomers,
    count: customers.length,
  });
});

// @desc    Broker soft-deletes a customer (moves to recycle bin)
// @route   DELETE /api/auth/deleteCustomer/:id
// @access  Private (Broker only, requires token)
const deleteCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id; // Use _id for MongoDB ObjectId
  const customerIdToDelete = req.params.id; // 10-digit Customer ID

  console.log('[deleteCustomer] Broker ID:', brokerIdFromToken);
  console.log('[deleteCustomer] Customer ID to delete:', customerIdToDelete);

  // Verify customer belongs to broker
  const customer = await CustomerModel.findOne({ 
    customer_id: customerIdToDelete, 
    attached_broker_id: brokerIdFromToken
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found or not linked to this broker.' });
  }

  console.log('[deleteCustomer] Found customer:', customer.name, customer.customer_id);

  // Get broker's login_id (10-digit string) for querying related data
  const broker = await BrokerModel.findById(brokerIdFromToken).select('login_id');
  const brokerIdStr = broker?.login_id || '';

  // =============================================
  // 📦 FETCH ALL RELATED DATA
  // =============================================

  // 1. Fetch Fund data
  const fundData = await FundModel.findOne({ 
    customer_id_str: customerIdToDelete,
    broker_id_str: brokerIdStr
  });
  console.log('[deleteCustomer] Fund data:', fundData ? 'Found' : 'Not found');

  // 2. Fetch all Orders
  const orders = await OrderModel.find({ 
    customer_id_str: customerIdToDelete,
    broker_id_str: brokerIdStr
  });
  console.log('[deleteCustomer] Orders found:', orders.length);

  // 3. Fetch Holdings (uses userId ObjectId)
  const holdings = await HoldingModel.find({ userId: customer._id });
  console.log('[deleteCustomer] Holdings found:', holdings.length);

  // 4. Fetch Positions (uses userId ObjectId)
  const positions = await PositionsModel.find({ userId: customer._id });
  console.log('[deleteCustomer] Positions found:', positions.length);

  // 5. Fetch Watchlist
  const watchlist = await UserWatchlistModel.findOne({ 
    customer_id_str: customerIdToDelete,
    broker_id_str: brokerIdStr
  });
  console.log('[deleteCustomer] Watchlist:', watchlist ? `${watchlist.instruments?.length || 0} instruments` : 'Not found');

  // =============================================
  // 📊 PREPARE ARCHIVED DATA
  // =============================================

  const archivedFund = fundData ? {
    net_available_balance: fundData.net_available_balance || 0,
    intraday: {
      available_limit: fundData.intraday?.available_limit || 0,
      used_limit: fundData.intraday?.used_limit || 0,
      free_limit: fundData.intraday?.free_limit || 0,
    },
    overnight: {
      available_limit: fundData.overnight?.available_limit || 0,
    },
    broker_mobile_number: fundData.broker_mobile_number,
  } : {};

  const archivedOrders = orders.map(order => ({
    broker_id_str: order.broker_id_str,
    customer_id_str: order.customer_id_str,
    security_Id: order.security_Id,
    symbol: order.symbol,
    segment: order.segment,
    side: order.side,
    product: order.product,
    price: order.price,
    closed_ltp: order.closed_ltp,
    expire: order.expire,
    came_From: order.came_From,
    quantity: order.quantity,
    lots: order.lots,
    lot_size: order.lot_size,
    stop_loss: order.stop_loss,
    target: order.target,
    exit_reason: order.exit_reason,
    margin_blocked: order.margin_blocked,
    filled_qty: order.filled_qty,
    avg_fill_price: order.avg_fill_price,
    order_status: order.order_status,
    order_category: order.order_category,
    increase_price: order.increase_price,
    broker_order_id: order.broker_order_id,
    exchange_order_id: order.exchange_order_id,
    notional_value: order.notional_value,
    placed_at: order.placed_at,
    closed_at: order.closed_at,
    updated_at: order.updated_at,
    meta: order.meta,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }));

  const archivedHoldings = holdings.map(h => ({
    symbol: h.symbol,
    qty: h.qty,
    avg: h.avg,
    ltp: h.ltp,
    net_change: h.net_change,
    day_change: h.day_change,
  }));

  const archivedPositions = positions.map(p => ({
    symbol: p.symbol,
    qty: p.qty,
    avg: p.avg,
    ltp: p.ltp,
    pnl: p.pnl,
    net_change: p.net_change,
    day_change: p.day_change,
    isLoss: p.isLoss,
    position_type: p.position_type,
  }));

  const archivedWatchlist = watchlist?.instruments || [];

  // Data summary for quick UI display
  const dataSummary = {
    total_orders: orders.length,
    open_orders: orders.filter(o => o.order_status === 'OPEN').length,
    closed_orders: orders.filter(o => o.order_status === 'CLOSED').length,
    total_holdings: holdings.length,
    total_positions: positions.length,
    watchlist_count: archivedWatchlist.length,
    fund_balance: fundData?.net_available_balance || 0,
  };

  // =============================================
  // 💾 CREATE ARCHIVED CUSTOMER RECORD
  // =============================================

  const archivedCustomer = await DeletedCustomerModel.create({
    customer_id: customer.customer_id,
    password: customer.password || '', // Handle missing password
    name: customer.name,
    role: customer.role,
    attached_broker_id: customer.attached_broker_id,
    original_id: customer._id,
    deleted_at: new Date(),
    deleted_by: brokerIdFromToken,
    original_created_at: customer.createdAt,
    // Archived data
    archived_fund: archivedFund,
    archived_orders: archivedOrders,
    archived_holdings: archivedHoldings,
    archived_positions: archivedPositions,
    archived_watchlist: archivedWatchlist,
    data_summary: dataSummary,
  });

  console.log('[deleteCustomer] Archived customer created:', archivedCustomer._id);
  console.log('[deleteCustomer] Data summary:', dataSummary);

  // =============================================
  // 🗑️ DELETE FROM ALL ORIGINAL COLLECTIONS
  // =============================================

  // Delete Customer
  await CustomerModel.deleteOne({ _id: customer._id });

  // Delete Fund
  if (fundData) {
    await FundModel.deleteOne({ _id: fundData._id });
  }

  // Delete all Orders
  if (orders.length > 0) {
    await OrderModel.deleteMany({ 
      customer_id_str: customerIdToDelete,
      broker_id_str: brokerIdStr
    });
  }

  // Delete Holdings
  if (holdings.length > 0) {
    await HoldingModel.deleteMany({ userId: customer._id });
  }

  // Delete Positions
  if (positions.length > 0) {
    await PositionsModel.deleteMany({ userId: customer._id });
  }

  // Delete Watchlist
  if (watchlist) {
    await UserWatchlistModel.deleteOne({ _id: watchlist._id });
  }

  console.log('[deleteCustomer] All data deleted from original collections');

  res.status(200).json({ 
    success: true, 
    message: 'Customer and all related data moved to Recycle Bin.',
    id: customerIdToDelete,
    data_summary: dataSummary
  });
});

// @desc    Broker gets list of deleted customers (Recycle Bin)
// @route   GET /api/auth/deleted-customers
// @access  Private (Broker only, requires token)
const getDeletedCustomers = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;

  console.log('[getDeletedCustomers] Broker ID:', brokerIdFromToken);

  const deletedCustomers = await DeletedCustomerModel
    .find({ attached_broker_id: brokerIdFromToken })
    .sort({ deleted_at: -1 }); // Most recent first

  console.log('[getDeletedCustomers] Found:', deletedCustomers.length, 'deleted customers');

  const formattedCustomers = deletedCustomers.map(customer => ({
    id: customer.customer_id,
    name: customer.name,
    password: customer.password, // Plain text password visible to broker
    joining_date: formatDate(customer.original_created_at),
    deleted_date: formatDate(customer.deleted_at),
    original_id: customer.original_id,
    // Include data summary
    data_summary: customer.data_summary || {
      total_orders: 0,
      open_orders: 0,
      closed_orders: 0,
      total_holdings: 0,
      total_positions: 0,
      watchlist_count: 0,
      fund_balance: 0,
    },
  }));

  res.status(200).json({
    success: true,
    deletedCustomers: formattedCustomers,
    count: deletedCustomers.length,
  });
});

// @desc    Broker restores a deleted customer from Recycle Bin
// @route   POST /api/auth/restore-customer/:id
// @access  Private (Broker only, requires token)
const restoreCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;
  const customerIdToRestore = req.params.id; // 10-digit Customer ID

  console.log('[restoreCustomer] Restoring customer:', customerIdToRestore);

  // Find in DeletedCustomer collection
  const deletedCustomer = await DeletedCustomerModel.findOne({
    customer_id: customerIdToRestore,
    attached_broker_id: brokerIdFromToken
  });

  if (!deletedCustomer) {
    return res.status(404).json({ success: false, message: 'Deleted customer not found.' });
  }

  // Check if customer_id already exists in Customer collection
  const existingCustomer = await CustomerModel.findOne({ customer_id: customerIdToRestore });
  if (existingCustomer) {
    return res.status(400).json({ success: false, message: 'A customer with this ID already exists. Cannot restore.' });
  }

  // Get broker's login_id for restoring related data
  const broker = await BrokerModel.findById(brokerIdFromToken).select('login_id');
  const brokerIdStr = broker?.login_id || '';

  // =============================================
  // 🔄 RESTORE CUSTOMER
  // =============================================

  const restoredCustomer = await CustomerModel.create({
    customer_id: deletedCustomer.customer_id,
    password: deletedCustomer.password || 'default123', // Fallback password if missing
    name: deletedCustomer.name,
    role: deletedCustomer.role,
    attached_broker_id: deletedCustomer.attached_broker_id,
  });

  console.log('[restoreCustomer] Customer restored:', restoredCustomer._id);

  // =============================================
  // 🔄 RESTORE FUND DATA
  // =============================================

  if (deletedCustomer.archived_fund && Object.keys(deletedCustomer.archived_fund).length > 0) {
    await FundModel.create({
      customer_id_str: deletedCustomer.customer_id,
      broker_id_str: brokerIdStr,
      net_available_balance: deletedCustomer.archived_fund.net_available_balance || 0,
      intraday: deletedCustomer.archived_fund.intraday || {},
      overnight: deletedCustomer.archived_fund.overnight || {},
      broker_mobile_number: deletedCustomer.archived_fund.broker_mobile_number,
    });
    console.log('[restoreCustomer] Fund data restored');
  }

  // =============================================
  // 🔄 RESTORE ORDERS
  // =============================================

  if (deletedCustomer.archived_orders && deletedCustomer.archived_orders.length > 0) {
    const ordersToRestore = deletedCustomer.archived_orders.map(order => ({
      broker_id_str: order.broker_id_str || brokerIdStr,
      customer_id_str: order.customer_id_str || deletedCustomer.customer_id,
      security_Id: order.security_Id,
      symbol: order.symbol,
      segment: order.segment,
      side: order.side,
      product: order.product,
      price: order.price,
      closed_ltp: order.closed_ltp,
      expire: order.expire,
      came_From: order.came_From,
      quantity: order.quantity,
      lots: order.lots,
      lot_size: order.lot_size,
      stop_loss: order.stop_loss,
      target: order.target,
      exit_reason: order.exit_reason,
      margin_blocked: order.margin_blocked,
      filled_qty: order.filled_qty,
      avg_fill_price: order.avg_fill_price,
      order_status: order.order_status,
      order_category: order.order_category,
      increase_price: order.increase_price,
      broker_order_id: order.broker_order_id,
      exchange_order_id: order.exchange_order_id,
      notional_value: order.notional_value,
      placed_at: order.placed_at,
      closed_at: order.closed_at,
      updated_at: order.updated_at,
      meta: order.meta,
    }));

    await OrderModel.insertMany(ordersToRestore);
    console.log('[restoreCustomer] Orders restored:', ordersToRestore.length);
  }

  // =============================================
  // 🔄 RESTORE HOLDINGS
  // =============================================

  if (deletedCustomer.archived_holdings && deletedCustomer.archived_holdings.length > 0) {
    const holdingsToRestore = deletedCustomer.archived_holdings.map(h => ({
      userId: restoredCustomer._id, // Use new customer _id
      symbol: h.symbol,
      qty: h.qty,
      avg: h.avg,
      ltp: h.ltp,
      net_change: h.net_change,
      day_change: h.day_change,
    }));

    await HoldingModel.insertMany(holdingsToRestore);
    console.log('[restoreCustomer] Holdings restored:', holdingsToRestore.length);
  }

  // =============================================
  // 🔄 RESTORE POSITIONS
  // =============================================

  if (deletedCustomer.archived_positions && deletedCustomer.archived_positions.length > 0) {
    const positionsToRestore = deletedCustomer.archived_positions.map(p => ({
      userId: restoredCustomer._id, // Use new customer _id
      symbol: p.symbol,
      qty: p.qty,
      avg: p.avg,
      ltp: p.ltp,
      pnl: p.pnl,
      net_change: p.net_change,
      day_change: p.day_change,
      isLoss: p.isLoss,
      position_type: p.position_type,
    }));

    await PositionsModel.insertMany(positionsToRestore);
    console.log('[restoreCustomer] Positions restored:', positionsToRestore.length);
  }

  // =============================================
  // 🔄 RESTORE WATCHLIST
  // =============================================

  if (deletedCustomer.archived_watchlist && deletedCustomer.archived_watchlist.length > 0) {
    await UserWatchlistModel.create({
      broker_id_str: brokerIdStr,
      customer_id_str: deletedCustomer.customer_id,
      instruments: deletedCustomer.archived_watchlist,
    });
    console.log('[restoreCustomer] Watchlist restored:', deletedCustomer.archived_watchlist.length, 'instruments');
  }

  // =============================================
  // 🗑️ REMOVE FROM DELETED CUSTOMERS
  // =============================================

  await DeletedCustomerModel.deleteOne({ _id: deletedCustomer._id });

  console.log('[restoreCustomer] Customer fully restored with all data');

  res.status(200).json({
    success: true,
    message: 'Customer and all related data restored successfully.',
    id: customerIdToRestore,
    data_summary: deletedCustomer.data_summary,
  });
});

// @desc    Broker permanently deletes a customer from Recycle Bin
// @route   DELETE /api/auth/permanent-delete/:id
// @access  Private (Broker only, requires token)
const permanentDeleteCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;
  const customerIdToDelete = req.params.id; // 10-digit Customer ID

  console.log('[permanentDelete] Broker ID:', brokerIdFromToken);
  console.log('[permanentDelete] Customer ID to delete:', customerIdToDelete);
  console.log('[permanentDelete] Customer ID type:', typeof customerIdToDelete);

  // Find in DeletedCustomer collection
  const deletedCustomer = await DeletedCustomerModel.findOne({
    customer_id: customerIdToDelete,
    attached_broker_id: brokerIdFromToken
  });

  console.log('[permanentDelete] Found deleted customer:', deletedCustomer ? 'Yes' : 'No');

  // Debug: List all deleted customers for this broker
  const allDeleted = await DeletedCustomerModel.find({ attached_broker_id: brokerIdFromToken });
  console.log('[permanentDelete] All deleted customers for broker:', allDeleted.map(c => ({ id: c.customer_id, name: c.name })));

  if (!deletedCustomer) {
    return res.status(404).json({ success: false, message: 'Deleted customer not found.' });
  }

  // Permanently delete
  await DeletedCustomerModel.deleteOne({ _id: deletedCustomer._id });

  res.status(200).json({
    success: true,
    message: 'Customer permanently deleted.',
    id: customerIdToDelete
  });
});

// @desc    Broker uploads/updates customer profile photo
// @route   PUT /api/auth/customer/:customerId/profile-photo
// @access  Private (Broker only)
const uploadProfilePhoto = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;
  const { customerId } = req.params;

  console.log('[uploadProfilePhoto] Broker ID:', brokerIdFromToken);
  console.log('[uploadProfilePhoto] Customer ID:', customerId);

  // Verify customer belongs to this broker
  const customer = await CustomerModel.findOne({
    customer_id: customerId,
    attached_broker_id: brokerIdFromToken
  });

  if (!customer) {
    return res.status(404).json({ 
      success: false, 
      message: 'Customer not found or not linked to this broker.' 
    });
  }

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: 'No image file provided.' 
    });
  }

  console.log('[uploadProfilePhoto] File received:', req.file.originalname, req.file.size, 'bytes');

  // Upload to Cloudinary
  const filename = `profile_${customerId}_${Date.now()}`;
  const uploadResult = await cloudinaryAdapter.upload(
    req.file.buffer,
    filename,
    'profile-photos'
  );

  if (!uploadResult.success) {
    console.error('[uploadProfilePhoto] Cloudinary upload failed:', uploadResult.error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to upload image. Please try again.' 
    });
  }

  console.log('[uploadProfilePhoto] Cloudinary upload successful:', uploadResult.url);

  // Update customer profile photo
  customer.profile_photo = uploadResult.url;
  await customer.save();

  res.status(200).json({
    success: true,
    message: 'Profile photo updated successfully.',
    profile_photo: uploadResult.url
  });
});

// @desc    Get customer details including profile photo
// @route   GET /api/auth/customer/:customerId
// @access  Private (Broker or Customer)
const getCustomerDetails = asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  const userFromToken = req.user;

  console.log('[getCustomerDetails] Requested customer:', customerId);
  console.log('[getCustomerDetails] User role:', userFromToken.role);

  let customer;

  if (userFromToken.role === 'broker') {
    // Broker can only see their own customers
    customer = await CustomerModel.findOne({
      customer_id: customerId,
      attached_broker_id: userFromToken._id
    }).select('-password');
  } else if (userFromToken.role === 'customer') {
    // Customer can only see their own profile
    if (userFromToken.customer_id !== customerId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied.' 
      });
    }
    customer = await CustomerModel.findOne({ 
      customer_id: customerId 
    }).select('-password');
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied.' 
    });
  }

  if (!customer) {
    return res.status(404).json({ 
      success: false, 
      message: 'Customer not found.' 
    });
  }

  res.status(200).json({
    success: true,
    customer: {
      id: customer.customer_id,
      name: customer.name,
      role: customer.role,
      profile_photo: customer.profile_photo || null,
      joining_date: formatDate(customer.createdAt),
    }
  });
});

export { 
  addCustomer, 
  getBrokerCustomers, 
  deleteCustomer, 
  getDeletedCustomers, 
  restoreCustomer, 
  permanentDeleteCustomer,
  uploadProfilePhoto,
  getCustomerDetails
};
