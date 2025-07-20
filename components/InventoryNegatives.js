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
                        // Render barcode SVG in SKU field, with SKU number below
                        if (obj["SKU"] && window.JsBarcode) {
                            try {
                                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                // Remove dashes from SKU before generating barcode
                                const value = obj["SKU"].replace(/-/g, "");
                                window.JsBarcode(svg, value, {
                                    format: "CODE128",
                                    width: 1.2,
                                    height: 60,
                                    margin: 12,
                                    displayValue: true,
                                    fontSize: 18,
                                    textMargin: 4
                                });
                                obj["SKU"] = svg.outerHTML;
                            } catch (e) {
                                // fallback to plain text
                            }
                        }
                        return obj;
                    });
                    console.log('[parseInventoryNegativesPDF] Parsed PDF Table Data (filtered, with barcode):', result);
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
                    // Clone table to avoid modifying the original
                    const clone = table.cloneNode(true);
                    // Add new header cell with checkbox icon
                    const thead = clone.querySelector('thead');
                    if (thead && thead.rows.length > 0) {
                        const headerRow = thead.rows[0];
                        const th = document.createElement('th');
                        th.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                        headerRow.appendChild(th);
                    }
                    // Add empty cell to each data row
                    const tbody = clone.querySelector('tbody');
                    if (tbody) {
                        Array.from(tbody.rows).forEach(row => {
                            const td = document.createElement('td');
                            td.innerHTML = '';
                            row.appendChild(td);
                        });
                    }
                    tablesHtml += clone.outerHTML + '<br/>';
                });
            }
            if (!tablesHtml) {
                alert('No table to print!');
                return;
            }
            const printWindow = window.open('', '', 'width=900,height=700');
            // Enlarge barcodes for print preview only and center them
            tablesHtml = tablesHtml.replace(/(<svg[^>]*)(width="[^"]*")?( height="[^"]*")?/g, function(match, svgTag, widthAttr, heightAttr) {
                // Set width and height for print and add center style
                return svgTag + ' width="400" height="160" style="display:block;margin:auto;"';
            });
            printWindow.document.write(`
                <html><head>
                <title>Print Table</title>
                <style>
                    body { font-family: sans-serif; background: #f9fafb; margin: 0; font-size: 4.2rem; }
                    table { border-collapse: collapse; width: 100%; font-size: 3.4rem; }
                    th, td { border: 1px solid #d1d5db; padding: 12px 18px; }
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
