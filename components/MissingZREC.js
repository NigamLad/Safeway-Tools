// MissingZREC.js
// Petite-Vue component for the Missing ZREC Document tool


// Helper to inject the ZREC card template from an external HTML file
function injectZRECCard(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (container) {
        fetch('components/MissingZREC.html')
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;
                if (window.PetiteVue && window.MissingZREC) {
                    window.PetiteVue.createApp().mount(container);
                }
            });
    }
}

function MissingZREC() {
    return {
        selectedFile: null,
        fileName: '',
        parsedData: null,
        showPreview: false,
        printTable() {
            // ...existing code...
            let tablesHtml = '';
            // Helper to add a blank column with a checkmark header to a table's HTML
            function addCheckmarkColumn(tableHtml) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(tableHtml, 'text/html');
                const table = doc.querySelector('table');
                if (!table) return tableHtml;
                // Add checkmark header
                const thead = table.querySelector('thead');
                if (thead) {
                    const headerRow = thead.querySelector('tr');
                    if (headerRow) {
                        const th = doc.createElement('th');
                        th.innerHTML = '&#10003;'; // checkmark
                        th.style.textAlign = 'center';
                        headerRow.appendChild(th);
                    }
                }
                // Add blank cell to each row in tbody
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    tbody.querySelectorAll('tr').forEach(row => {
                        const td = doc.createElement('td');
                        td.innerHTML = '';
                        row.appendChild(td);
                    });
                }
                return table.outerHTML;
            }
            if (this.showPreview) {
                const popup = document.querySelector('.fixed.inset-0 .max-w-6xl');
                if (popup) {
                    const tables = popup.querySelectorAll('table');
                    tables.forEach(table => {
                        tablesHtml += addCheckmarkColumn(table.outerHTML) + '<br/>';
                    });
                }
            } else {
                const card = document.querySelector('[v-scope]');
                if (card) {
                    const tables = card.querySelectorAll('table');
                    tables.forEach(table => {
                        tablesHtml += addCheckmarkColumn(table.outerHTML) + '<br/>';
                    });
                }
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
                    table { border-collapse: collapse; width: 100%; font-size: 18px; }
                    th, td { border: 1px solid #d1d5db; padding: 10px 16px; }
                    th { background: #f3f4f6; font-size: 20px; }
                    tr:nth-child(even) { background: #f9fafb; }
                </style>
                </head><body>` + tablesHtml + `</body></html>`);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        },
        handleFileChange(e) {
            // ...existing code...
            const file = e.target.files[0];
            this.selectedFile = file || null;
            this.fileName = file ? file.name : '';
            this.parsedData = null;
            this.showPreview = false;
            if (file && file.name.match(/\.(xls|xlsx)$/i)) {
                this.parseXLS(file);
            } else if (file) {
                console.warn('Please upload an Excel (.xls or .xlsx) file.');
            }
        },
        parseXLS(file) {
            // ...existing code...
            const reader = new FileReader();
            reader.onload = (evt) => {
                const data = evt.target.result;
                let workbook;
                try {
                    workbook = window.XLSX.read(data, { type: 'binary' });
                } catch (err) {
                    console.error('Error reading XLSX:', err);
                    return;
                }
                const keepColumns = [
                    'Reference',
                    'Name of vendor',
                    'Payment reference',
                    'Net Value',
                    'Tax amount',
                    'Gross value'
                ];
                // Helper to convert Excel serial date to YYYY-MM-DD
                function excelDateToISO(serial) {
                    if (typeof serial !== 'number') return serial;
                    // Excel incorrectly treats 1900 as a leap year, so dates >= 60 are offset by 1
                    const utc_days = Math.floor(serial - 25569);
                    const utc_value = utc_days * 86400; // seconds
                    const date_info = new Date(utc_value * 1000);
                    // Format as YYYY-MM-DD
                    return date_info.toISOString().slice(0, 10);
                }
                const result = {};
                workbook.SheetNames.forEach(sheetName => {
                    const roa = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
                    if (roa.length) {
                        // Filter each row to only keep the specified columns
                        const filteredRows = roa.map(row => {
                            const filtered = {};
                            keepColumns.forEach(col => {
                                let value = row[col] !== undefined ? row[col] : null;
                                // Convert date fields if they are numbers (Excel serials)
                                if ((col === 'Posting date' || col === 'Document Date') && typeof value === 'number') {
                                    value = excelDateToISO(value);
                                }
                                filtered[col] = value;
                            });
                            return filtered;
                        });
                        result[sheetName] = filteredRows;
                    }
                });
                this.parsedData = result;
                console.log('Parsed XLS Data:', result);
            };
            reader.readAsBinaryString(file);
        }
    }
}
window.MissingZREC = MissingZREC;
window.injectZRECCard = injectZRECCard;
