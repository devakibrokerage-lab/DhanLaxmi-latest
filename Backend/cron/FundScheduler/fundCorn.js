import cron from 'node-cron';
import Fund from '../../Model/FundModel.js';

const FundCronJobs = () => {
    
    // ---------------------------------------------------------
    // Job: Reset Intraday Limits at 12:00 AM IST
    // ---------------------------------------------------------
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ [CRON] Running Midnight Intraday Reset...');

        try {
            // Hum Aggregation Pipeline [...] use kar rahe hain
            // Taaki hum existing field ($available_limit) ki value copy kar sakein.
            
            const result = await Fund.updateMany(
                {}, // Filter: Sabhi funds select karo
                [
                    {
                        $set: {
                            // 1. Used Limit ko 0 set karo (Reset)
                            "intraday.used_limit": 0, 
                            
                            // 2. Free Limit ko wapis Total Available Limit ke barabar set karo.
                            // '$' ka matlab hai database se us field ki value uthao.
                            // $ifNull ka matlab: Agar available_limit nahi mila, to 0 set karo (Safety)
                            "intraday.free_limit": { 
                                $ifNull: ["$intraday.available_limit", 0] 
                            } 
                        }
                    }
                ]
            );

            console.log(`✅ [CRON] Success! Reset limits for ${result.modifiedCount} funds.`);
        } catch (error) {
            console.error("❌ [CRON] Error resetting intraday limits:", error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Server pe Timezone zaroori hai agar local nahi hai
    });
};

export default FundCronJobs;