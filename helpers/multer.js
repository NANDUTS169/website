
// // const multer = require('multer');
// // const path = require('path');

// // const getStorage = (folder) =>
// //   multer.diskStorage({
// //     destination: (req, file, cb) => {
// //       cb(null, path.join(__dirname, `../Public/uploads/${folder}`));
// //     },
// //     filename: (req, file, cb) => {
// //       const ext = path.extname(file.originalname);
// //       cb(null, Date.now() + '-' + file.fieldname + ext);
// //     },
// //   });

// // const uploadProductImages = multer({ storage: getStorage('product-images') });
// // const uploadRawImages = multer({ storage: getStorage('re-image') });
// // const uploadProfileImage = multer({ storage: getStorage('profile') });

// // module.exports = {
// //   uploadProductImages,
// //   uploadRawImages,
// //   uploadProfileImage,
// // };



// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// const ensureDir = (dir) => {
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
// };

// const getStorage = (folder) =>
//   multer.diskStorage({
//     destination: (req, file, cb) => {
//       const uploadDir = path.join(__dirname, '..', 'public', 'uploads', folder);
//       ensureDir(uploadDir);
//       cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//       const ext = path.extname(file.originalname) || '';
//       cb(null, Date.now() + '-' + file.fieldname + ext);
//     },
//   });

// const uploadProductImages = multer({ storage: getStorage('product-images') });
// const uploadRawImages     = multer({ storage: getStorage('re-image') });
// const uploadProfileImage  = multer({ storage: getStorage('profile') });

// module.exports = {
//   uploadProductImages,
//   uploadRawImages,
//   uploadProfileImage,
// };


const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const getStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', 'public', 'uploads', folder);
      ensureDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, Date.now() + '-' + file.fieldname + ext);
    },
  });

const uploadProductImages = multer({ storage: getStorage('product-images') });
const uploadRawImages     = multer({ storage: getStorage('re-image') });
const uploadProfileImage  = multer({ storage: getStorage('profile') });
// NEW: brand-specific upload folder
const uploadBrandImage    = multer({ storage: getStorage('brand') });

module.exports = {
  uploadProductImages,
  uploadRawImages,
  uploadProfileImage,
  uploadBrandImage, // <-- exported for router use
};
