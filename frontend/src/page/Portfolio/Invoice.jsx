
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateExitBrokerageAndPnL } from '../../Utils/calculateBrokerage';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Helper for currency formatting
const money = (n) => `₹${Number(n ?? 0).toFixed(2)} `;

export default function Invoice() {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [margin, setMargin] = useState(''); // Margin Input State
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [invoiceData, setInvoiceData] = useState([]);
    const [summary, setSummary] = useState({ totalTurnover: 0, totalPnl: 0, totalBrokerage: 0, netPnl: 0 });

    // Get User Context
    const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');
    const { brokerId, customerId } = activeContext;
    const token = localStorage.getItem("token");

    // Resolve Client Name
    let clientName = localStorage.getItem('customerName');
    if (!clientName) {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        if (String(loggedInUser.id) === String(customerId)) {
            clientName = loggedInUser.name;
        }
    }

    // Fetch Orders
    const fetchOrders = async () => {
        if (!brokerId || !customerId) return;
        setLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "";
            // Fetching ALL closed orders first, then we filter client-side or we could add date params to API if supported
            // For now, fetching all closed orders as per Portfolio logic
            const res = await fetch(`${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=CLOSED`, {
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });

            if (!res.ok) throw new Error("Failed to fetch orders");
            const data = await res.json();
            setOrders(Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Set default dates (start of month to today)
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);

        fetchOrders();
    }, []);

    const generateInvoice = () => {
        if (!startDate || !endDate) return;

        const start = new Date(startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);

        const filtered = orders.filter(o => {
            const date = new Date(o.closed_at || o.updatedAt || o.createdAt);
            return date >= start && date <= end;
        });

        // Process Data for Invoice
        let totalTurnover = 0;
        let totalPnl = 0;
        let totalBrokerageAccumulated = 0;

        const processed = filtered.map(order => {
            const qty = parseFloat(order.quantity) || 0;
            let entryPrice = parseFloat(order.average_price) || parseFloat(order.price) || 0;
            let exitPrice = parseFloat(order.closed_ltp) || parseFloat(order.ltp) || 0;
            const side = String(order.side ?? "").toUpperCase();

            const { entryValue, exitValue, netPnl, totalBrokerage } = calculateExitBrokerageAndPnL({
                side,
                avgPrice: entryPrice,
                exitPrice,
                qty
            });

            // Fallback: If totalBrokerage is undefined/0 but it shouldn't be, calc manually (default 0.01%)
            const finalBrokerage = totalBrokerage || ((entryValue + exitValue) * 0.0001);

            totalTurnover += (entryValue + exitValue);
            totalPnl += netPnl;
            totalBrokerageAccumulated += finalBrokerage;

            return {
                ...order,
                qty,
                entryPrice,
                exitPrice,
                entryValue,
                exitValue,
                netPnl,
                totalBrokerage: finalBrokerage,
                date: new Date(order.closed_at || order.updatedAt).toLocaleDateString()
            };
        });

        setInvoiceData(processed);
        setSummary({
            totalTurnover,
            totalPnl,
            totalBrokerage: totalBrokerageAccumulated,
            netPnl: totalPnl // Net PnL likely already includes basic brokerage deduction in utility
        });
        setGenerated(true);
    };

    // --- PDF DOWNLOAD HANDLER (High Quality & Print-Like) ---
    const handleDownloadPDF = async () => {
        const originalElement = document.getElementById('invoice-content');
        if (!originalElement) return;

        try {
            setLoading(true);

            // 1. Create a container that matches A4 width exactly (210mm)
            const captureContainer = document.createElement('div');
            captureContainer.style.position = 'fixed';
            captureContainer.style.top = '-10000px';
            captureContainer.style.left = '-10000px';
            captureContainer.style.width = '210mm'; // Exact A4 width
            captureContainer.style.minHeight = '297mm'; // A4 height
            captureContainer.style.backgroundColor = '#ffffff';
            captureContainer.style.zIndex = '-9999';

            // 2. Clone and Style
            const clonedContent = originalElement.cloneNode(true);

            // Apply Print Styles to Clone
            clonedContent.style.width = '100%';
            clonedContent.style.height = '100%';
            clonedContent.style.margin = '0';
            clonedContent.style.padding = '10mm'; // Standard print padding
            clonedContent.style.backgroundColor = '#ffffff';
            clonedContent.style.color = '#000000'; // Base text black

            // --- INJECT EXTRA SPACING FOR PDF ONLY ---
            // Find the header div (first child div with border-b)
            const headerDiv = clonedContent.querySelector('div.border-b');
            if (headerDiv) {
                headerDiv.style.marginBottom = '0px'; // Increase gap for PDF
                headerDiv.style.paddingBottom = '30px';
            }

            // Find the summary footer (div with border-t) and add top margin
            const summaryDiv = clonedContent.querySelector('div.border-t');
            if (summaryDiv) {
                summaryDiv.style.marginTop = '40px'; // Extra space above Turnover
                summaryDiv.style.paddingTop = '20px';
            }

            const footerdiv = clonedContent.querySelector('div.footer-line');
            if (footerdiv) {
                footerdiv.style.marginTop = '40px'; // Extra space above Turnover

            }

            const taxinvoice = clonedContent.querySelector('h1.tax-invoice');
            if (taxinvoice) {
                taxinvoice.style.fontSize = '1.875rem';
                taxinvoice.style.marginBottom = '20px'; // Extra space above Turnover

            }
            // -----------------------------------------

            // Force all text children to be black for sharpness
            const allElements = clonedContent.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.color = '#000000';
                // Remove shadows/borders that look bad in print
                el.style.boxShadow = 'none';
            });

            captureContainer.appendChild(clonedContent);
            document.body.appendChild(captureContainer);

            // 3. Capture with High Scale
            const canvas = await html2canvas(captureContainer, {
                scale: 3, // 3x resolution for crisp text
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: captureContainer.scrollWidth,
                windowHeight: captureContainer.scrollHeight
            });

            // 4. Cleanup
            document.body.removeChild(captureContainer);

            // 5. Generate PDF
            const imgData = canvas.toDataURL('image/jpeg', 0.98); // JPEG is faster/smaller for high res
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Calculate height to fit width
            const imgFinalHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgFinalHeight);
            pdf.save(`Invoice_${customerId || 'Client'}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert(`Failed to generate PDF: ${error.message || error}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // If not generated, show form
    if (!generated) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] p-4 flex flex-col items-center pt-20">
                <div className="w-full max-w-md bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border-color)] p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold">Generate Tax Invoice</h1>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg py-2 pl-10 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg py-2 pl-10 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Margin Input */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Margin Used ( ₹ )</label>
                            <input
                                type="number"
                                value={margin}
                                onChange={(e) => setMargin(e.target.value)}
                                placeholder="Enter Margin Amount"
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg py-2 px-4 text-[var(--text-primary)] focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <button
                            onClick={generateInvoice}
                            disabled={loading}
                            className="w-full bg-[#00B050] hover:bg-[#009040] text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
                        >
                            {loading ? 'Loading Data...' : 'Generate Invoice'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Invoice View
    return (
        <div className="min-h-screen bg-white text-black p-8 print:p-0">
            {/* Print / Download Controls - Hidden in Print */}
            <div className="max-w-4xl mx-auto mb-8 flex justify-between print:hidden">
                <button onClick={() => setGenerated(false)} className="flex items-center gap-2 text-gray-600 hover:text-black">
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex gap-2">
                    {/* Manual PDF Download Button */}
                    <button onClick={handleDownloadPDF} className="flex items-center gap-2 bg-[#00B050] text-white px-4 py-2 rounded-lg hover:bg-[#009040]">
                        <Download className="w-4 h-4" /> Download PDF
                    </button>
                    {/* Legacy Print Button
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                        <Printer className="w-4 h-4" /> Print
                    </button> */}
                </div>
            </div>

            {/* Invoice Document - ID added for html2canvas */}
            <div id="invoice-content" className="max-w-4xl mx-auto border border-[#e5e7eb] p-8 bg-white shadow-sm print:shadow-none print:border-none">

                {/* Header */}
                <div className="flex justify-between items-start border-b border-[#e5e7eb] pb-6 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-[#111827] mb-2 tax-invoice">TAX INVOICE</h1>
                        <p className="text-[#6b7280]">Statement of Accounts</p>
                        <div className="mt-4 text-xs text-[#4b5563]">
                            <p><strong>Period:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                            <p><strong>Generated On:</strong> {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="text-right">
                        <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-2">Bill To : {clientName}</h3>
                        <p className="text-[#4b5563]">Client ID: {customerId}</p>
                    </div>
                </div>

                {/* Old Bill To Block Removed */}


                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#f3f4f6] text-[#4b5563] font-semibold uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Date</th>
                                <th className="px-4 py-3">Symbol</th>
                                {/* <th className="px-4 py-3">Type</th> */}
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Buy Avg</th>
                                <th className="px-4 py-3 text-right">Sell Avg</th>
                                <th className="px-4 py-3 text-right">Brokerage</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Net P&L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3f4f6]">
                            {invoiceData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-[#f9fafb]">
                                    <td className="px-4 py-3 text-[#6b7280]">{item.date}</td>
                                    <td className="px-4 py-3 font-medium text-[#111827] break-words whitespace-normal max-w-[150px]">{item.symbol}</td>

                                    <td className="px-4 py-3 text-right text-[#374151]">{item.qty}</td>
                                    <td className="px-4 py-3 text-right text-[#374151]">{item.entryPrice.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-[#374151]">{item.exitPrice.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-[#374151]">{money(item.totalBrokerage)}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${item.netPnl >= 0 ? 'text-[#00B050]' : 'text-[#ef4444]'}`}>
                                        {money(item.netPnl)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                <div className="mt-6 pt-4 border-t border-[#e5e7eb] flex justify-end">
                    <div className="w-64 space-y-2 text-sm">
                        <div className="flex justify-between text-[#4b5563]">
                            <span>Total Turnover</span>
                            <span>{money(summary.totalTurnover)}</span>
                        </div>
                        <div className="flex justify-between text-[#4b5563]">
                            <span>Brokerage & Charges</span>
                            <span>{money(summary.totalBrokerage)}</span>
                        </div>
                        {/* Display Margin if entered */}
                        {margin && (
                            <div className="flex justify-between text-[#4b5563]">
                                <span>Margin Used</span>
                                <span>{money(margin)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-bold text-[#111827] pt-2 border-t border-[#e5e7eb]">
                            <span>Net Profit / Loss</span>
                            <span className={summary.netPnl >= 0 ? 'text-[#00B050]' : 'text-[#dc2626]'}>
                                {money(summary.netPnl)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Note */}
                <div className="mt-8 text-center text-[10px] text-[#9ca3af] footer-line">
                    {/* <p>This is a computer generated invoice and does not require a signature.</p> */}
                    <p className="mt-1">© 2025 {localStorage.getItem('organizationName') || 'DhanLaxmi'} Broking Ltd. All rights reserved.</p>
                </div>

            </div>
        </div>
    );
}
