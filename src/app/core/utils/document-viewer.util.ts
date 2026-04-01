/**
 * Document viewer utility for opening attachments
 * Provides a more robust way to view documents than window.open().document.write()
 */

/**
 * Open a document in a new tab
 * @param attachment - Attachment object with data property (base64 or URL)
 * @param title - Optional title for the new tab
 */
export function openDocument(attachment: any, title: string = 'Document'): void {
  if (!attachment?.data) {
    return;
  }

  // Create a new window/tab
  const newWindow = window.open('', '_blank');
  
  if (!newWindow) {
    alert('Please allow pop-ups to view documents.');
    return;
  }

  // Write HTML content to the new window
  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        .header {
          background: #1a5336;
          color: white;
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 {
          font-size: 16px;
          font-weight: 600;
        }
        .close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        .close-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          overflow: auto;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <button class="close-btn" onclick="window.close()">Close</button>
      </div>
      <div class="content">
        <iframe src="${attachment.data}"></iframe>
      </div>
    </body>
    </html>
  `);
  
  newWindow.document.close();
}

/**
 * Check if an attachment is an image
 */
export function isImageAttachment(attachment: any): boolean {
  if (!attachment?.type) return false;
  return attachment.type.startsWith('image/');
}

/**
 * Check if an attachment is a PDF
 */
export function isPdfAttachment(attachment: any): boolean {
  if (!attachment?.type) return false;
  return attachment.type === 'application/pdf';
}

/**
 * Get file extension from attachment name
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}
