export const Flags = {
  publicPdfDownload: process.env.PUBLIC_PDF_DOWNLOAD === 'true',
  enableXlsxExport: process.env.ENABLE_XLSX_EXPORT === 'true',
  enableEmails: process.env.ENABLE_EMAILS === 'true'
};
