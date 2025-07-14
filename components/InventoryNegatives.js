// InventoryNegatives.js
// Petite-Vue component for the Inventory Negatives card

// Helper to inject the Inventory Negatives card template from an external HTML file

// Minimal PDF table extraction for Inventory Negatives
function parseInventoryNegativesPDF(file) {
    console.log('[parseInventoryNegativesPDF] called');
    return new Promise(async (resolve, reject) => {
        let pdfjsLib;
        try {
            console.log('[parseInventoryNegativesPDF] importing PDF.js...');
            pdfjsLib = (await import('https://mozilla.github.io/pdf.js/build/pdf.mjs'));
            console.log('[parseInventoryNegativesPDF] PDF.js loaded');
        } catch (e) {
            alert('Failed to load PDF.js module.');
            console.error('[parseInventoryNegativesPDF] PDF.js import failed', e);
            reject(e);
            return;
        }
        if (!pdfjsLib || !pdfjsLib.getDocument) {
            alert('PDF.js is not loaded.');
            console.error('[parseInventoryNegativesPDF] PDF.js is not loaded');
            reject(new Error('PDF.js is not loaded.'));
            return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';

        const reader = new FileReader();
        reader.onload = async (evt) => {
            console.log('[parseInventoryNegativesPDF] FileReader loaded');
            const typedarray = new Uint8Array(evt.target.result);
            try {
                console.log('[parseInventoryNegativesPDF] Starting PDF parse...');
                const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
                console.log(`[parseInventoryNegativesPDF] PDF loaded, numPages: ${pdf.numPages}`);
                let allRows = [];
                let allRowsWithX = [];
                const Y_THRESHOLD = 2;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    let fuzzyRows = [];
                    content.items.forEach(item => {
                        const y = item.transform[5];
                        let row = fuzzyRows.find(r => Math.abs(r.y - y) < Y_THRESHOLD);
                        if (!row) {
                            row = { y, items: [] };
                            fuzzyRows.push(row);
                        }
                        row.items.push(item);
                    });
                    fuzzyRows.sort((a, b) => b.y - a.y);
                    fuzzyRows.forEach(row => {
                        const sorted = row.items.sort((a, b) => a.transform[4] - b.transform[4]);
                        allRows.push(sorted.map(item => item.str));
                        allRowsWithX.push(sorted.map(item => ({str: item.str, x: item.transform[4]})));
                    });
                }
                console.log('[parseInventoryNegativesPDF] Raw rows extracted:', allRows.length);
                allRows = allRows.filter(row => row.length > 6 && row.some(cell => cell.trim() !== ''));
                allRowsWithX = allRowsWithX.filter(row => row.length > 6 && row.some(cell => cell.str.trim() !== ''));
                allRows = allRows.map(row => row.slice(1));
                allRowsWithX = allRowsWithX.map(row => row.slice(1));
                let found15 = false;
                let filteredRows = [];
                let filteredRowsWithX = [];
                for (let i = 0; i < allRows.length; i++) {
                    if (allRows[i].length === 15) {
                        if (!found15) {
                            filteredRows.push(allRows[i]);
                            filteredRowsWithX.push(allRowsWithX[i]);
                            found15 = true;
                        }
                    } else {
                        filteredRows.push(allRows[i]);
                        filteredRowsWithX.push(allRowsWithX[i]);
                    }
                }
                allRows = filteredRows;
                allRowsWithX = filteredRowsWithX;
                let headers = [];
                let headerXs = [];
                let dataRows = [];
                if (allRowsWithX.length > 1) {
                    headers = allRowsWithX[0].map(cell => cell.str);
                    headerXs = allRowsWithX[0].map(cell => cell.x);
                    dataRows = allRowsWithX.slice(1).map(row => {
                        let cells = Array(headerXs.length).fill("");
                        let colIdx = 0;
                        for (let i = 0; i < row.length && colIdx < headerXs.length; i++, colIdx++) {
                            cells[colIdx] = row[i].str;
                        }
                        return cells;
                    });
                }
                let result = [];
                if (headers.length && dataRows.length) {
                    const keepFields = ["SKU", "Description", "Qty"];
                    result = dataRows.map(row => {
                        const obj = {};
                        headers.forEach((h, idx) => {
                            if (keepFields.includes(h)) obj[h] = row[idx];
                        });
                        return obj;
                    });
                    console.log('[parseInventoryNegativesPDF] Parsed PDF Table Data (filtered):', result);
                    resolve(result);
                } else {
                    console.log('[parseInventoryNegativesPDF] No table detected, showing raw rows:', allRows);
                    resolve(allRows);
                }
            } catch (err) {
                alert('Failed to parse PDF: ' + err);
                console.error('[parseInventoryNegativesPDF] PDF parse error', err);
                reject(err);
            }
        };
        reader.onloadstart = () => console.log('[parseInventoryNegativesPDF] FileReader load started');
        reader.onerror = (e) => {
            console.error('[parseInventoryNegativesPDF] FileReader error', e);
            reject(e);
        };
        reader.readAsArrayBuffer(file);
        console.log('[parseInventoryNegativesPDF] FileReader readAsArrayBuffer called');
    });
}

// Export for global access (for loader/HTML detection)
window.parseInventoryNegativesPDF = parseInventoryNegativesPDF;

// Petite-Vue component for Inventory Negatives card
window.InventoryNegatives = function() {
    return {
        fileName: '',
        showPreview: false,
        showInstructions: false,
        parsedData: null,
        selectedFile: null,
        handleFileChange(e) {
            const file = e.target.files[0];
            this.selectedFile = file || null;
            this.fileName = file ? file.name : '';
            this.parsedData = null;
            this.showPreview = false;
            if (file && file.name.match(/\.pdf$/i)) {
                this.parsePDF(file);
            } else if (file) {
                alert('Please upload a PDF file.');
            }
        },
        async parsePDF(file) {
            this.parsedData = null;
            try {
                const data = await window.parseInventoryNegativesPDF(file);
                this.parsedData = data;
            } catch (err) {
                alert('Failed to parse PDF: ' + err);
            }
        },
        printTable() {
            let tablesHtml = '';
            // Try to find the preview popup
            const popup = document.querySelector('.fixed.inset-0 .max-w-2xl');
            if (popup) {
                const tables = popup.querySelectorAll('table');
                tables.forEach(table => {
                    tablesHtml += table.outerHTML + '<br/>';
                });
            }
            if (!tablesHtml) {
                alert('No table to print!');
                return;
            }
            const printWindow = window.open('', '', 'width=900,height=700');
            printWindow.document.write(`
                <html><head>
                <title>Print Table</title>
                <style>
                    body { font-family: sans-serif; background: #f9fafb; margin: 0; padding: 2em; }
                    table { border-collapse: collapse; width: 100%; font-size: 13px; }
                    th, td { border: 1px solid #d1d5db; padding: 6px 10px; }
                    th { background: #f3f4f6; }
                    tr:nth-child(even) { background: #f9fafb; }
                </style>
                </head><body>` + tablesHtml + `</body></html>`);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    };
};

// Helper to inject the Inventory Negatives card template from an external HTML file
window.injectInventoryNegativesCard = function(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (container) {
        fetch('components/InventoryNegatives.html')
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;
                if (window.PetiteVue && window.InventoryNegatives) {
                    window.PetiteVue.createApp().mount(container);
                }
            });
    }
};
