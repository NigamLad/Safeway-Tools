// MissingZREC.js
// Petite-Vue component for the Missing ZREC Document tool

function MissingZREC() {
    return {
        selectedFile: null,
        fileName: '',
        parsedData: null,
        showPreview: false,
        printTable() {
            // Find the preview popup or the table container
            let tablesHtml = '';
            // If preview is open, print the tables in the popup
            if (this.showPreview) {
                // Find all tables in the popup
                const popup = document.querySelector('.fixed.inset-0 .max-w-3xl');
                if (popup) {
                    const tables = popup.querySelectorAll('table');
                    tables.forEach(table => {
                        tablesHtml += table.outerHTML + '<br/>';
                    });
                }
            } else {
                // If not in popup, print all tables in the main card (if any)
                const card = document.querySelector('[v-scope]');
                if (card) {
                    const tables = card.querySelectorAll('table');
                    tables.forEach(table => {
                        tablesHtml += table.outerHTML + '<br/>';
                    });
                }
            }
            if (!tablesHtml) {
                alert('No table to print!');
                return;
            }
            // Open print window with only the tables
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
        },
        handleFileChange(e) {
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
                const result = {};
                workbook.SheetNames.forEach(sheetName => {
                    const roa = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
                    if (roa.length) result[sheetName] = roa;
                });
                this.parsedData = result;
                console.log('Parsed XLS Data:', result);
            };
            reader.readAsBinaryString(file);
        }
    }
}
window.MissingZREC = MissingZREC;
