// Example Controller Function
import Fund from '../Model/FundModel.js'; // Ensure casing matches exactly
import asyncHandler from 'express-async-handler';

const updateNetAvailableBalance = async (req, res) => {
    console.log("fund hit")
    const { broker_id_str, customer_id_str, new_balance } = req.body;

    try {
        const updatedFund = await Fund.findOneAndUpdate(
            { broker_id_str, customer_id_str },
            { 
                $set: { 
                    net_available_balance: new_balance,
                } 
            },
            { new: true, upsert: true } // Create if not exists
        );

        res.status(200).json({ success: true, data: updatedFund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getFunds = asyncHandler(async (req, res) => {

    const { broker_id_str, customer_id_str } = req.query;

    // 2. Validation
    if (!broker_id_str || !customer_id_str) {
        res.status(400);
        throw new Error("Missing Broker ID or Customer ID");
    }

    // 3. Database mein Fund find karein
    let fund = await Fund.findOne({ 
        broker_id_str, 
        customer_id_str 
    });

    // 4. Agar Fund record nahi mila (New User), to Default create karein
    if (!fund) {
        fund = await Fund.create({
            broker_id_str,
            customer_id_str,
            net_available_balance: 0,
            intraday: {
                available_limit: 0,
                used_limit: 0
            },
            overnight: {
                available_limit: 0,
                used_limit: 0
            }
        });
        console.log(`New Fund record created for Customer: ${customer_id_str}`);
    }

    // 5. Response bhejein
    res.status(200).json({
        success: true,
        data: fund
    });
});


const updateIntradayLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;

    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "intraday.available_limit": new_limit 
            } 
        },
        { new: true }
    );

    if (!updatedFund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    res.status(200).json({ success: true, data: updatedFund });
});


const updateIntradayAvailabeLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;
    console.log('newlimit', new_limit)
    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "intraday.available_limit": new_limit 
            } 
        },
        { new: true }
    );

    if (!updatedFund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    res.status(200).json({ success: true, data: updatedFund });
});



const updateOvernightAvailableLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;

    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "overnight.available_limit": new_limit 
            } 
        },
        { new: true }
    );

    if (!updatedFund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    res.status(200).json({ success: true, data: updatedFund });
});




const updateBrokerMobile = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, mobile } = req.body;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
    }
    
    if (!mobile) {
        return res.status(400).json({ success: false, message: "Mobile number is required" });
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str }, // 1. Filter
        { 
            $set: { 
                broker_mobile_number: Number(mobile) 
            } 
        }, // 2. Update
        { new: true, upsert: true } // 3. Options
    );

    res.status(200).json({ 
        success: true, 
        message: "Mobile Number Updated Successfully", 
        data: updatedFund 
    });
});

const updateOptionLimitPercentage = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, percentage } = req.body;

    if (percentage === undefined || percentage === null) {
        return res.status(400).json({ success: false, message: "Percentage is required" });
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                option_limit_percentage: Number(percentage) 
            } 
        },
        { new: true }
    );

    if (!updatedFund) {
        return res.status(404).json({ success: false, message: "Fund record not found" });
    }

    res.status(200).json({ success: true, data: updatedFund });
});

export { getFunds, updateNetAvailableBalance, updateIntradayLimit, updateIntradayAvailabeLimit, updateOvernightAvailableLimit, updateBrokerMobile, updateOptionLimitPercentage };
