import { API_URL } from '../config.js';

export const getFundsData = async () => {
    try {
        const apiBase = API_URL;
        const token = localStorage.getItem("token");
        const activeContextString = localStorage.getItem('activeContext');

        if (!token || !activeContextString) return null;

        const { brokerId, customerId } = JSON.parse(activeContextString);

        if (!brokerId || !customerId) return null;

        // *** FIX: Ensure NO SPACES in query params ***
        const endpoint = `${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`;

        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return null;
        }

        const result = await response.json();

        if (result.success && result.data) {
            return result.data;
        } else {
            return null;
        }

    } catch (error) {
        console.error("[getFundsData] Error:", error);
        return null;
    }
};
