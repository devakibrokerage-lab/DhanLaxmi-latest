import 'dotenv/config';        // ensure .env loaded (ESM)
import DhanCredential from '../Model/DhanCredential.js';

export const getDhanCredentials = async () => {
  try {
    const credentials = await DhanCredential.findOne();
    return credentials;
  } catch (error) {
    console.error('Error getting Dhan credentials from DB:', error);
    return null;
  }
};

export const updateDhanAccessToken = async (clientId, newToken) => {
  try {
    // Find and update by clientId to ensure we update the correct document
    // and respect the unique constraint
    const credentials = await DhanCredential.findOneAndUpdate(
      { clientId: clientId },              // Filter by specific clientId
      {
        accessToken: newToken,
        // updatedAt automatically updated by { timestamps: true }
      },
      {
        new: true,                         // Return updated document
        upsert: false                      // Don't create if not exists - fail instead
      }
    );

    if (!credentials) {
      console.error(`❌ No DhanCredential found for clientId: ${clientId}. Cannot update token.`);
      console.error('   Run initialization script first: node scripts/init-dhan-credentials.js');
      return null;
    }

    console.log(`✅ Updated access token in database for clientId: ${clientId}`);
    console.log(`   Updated at: ${credentials.updatedAt}`);
    return credentials;
  } catch (error) {
    console.error('❌ Error updating Dhan access token in DB:', error);
    return null;
  }
};

export const initializeDhanCredentials = async (clientId, accessToken) => {
    try {
        let credentials = await DhanCredential.findOne({ clientId: clientId });
        if (!credentials) {
            credentials = new DhanCredential({ clientId, accessToken });
            await credentials.save();
            console.log('Dhan credentials initialized in DB.');
        } else {
            console.log('Dhan credentials already exist in DB.');
        }
        return credentials;
    } catch (error) {
        console.error('Error initializing Dhan credentials in DB:', error);
        return null;
    }
};
