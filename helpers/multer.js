// const multer = require('multer');
// const path = require('path');

// const storage = multer.diskStorage({
//     destination:(req,file,cb) => {
//         cb(null,path.join(__dirname,"../public/uploads/re-image"));
//     },
//     filename:(req,file,cb) => {
//         cb(null,Date.now()+"-"+file.originalname);
//     }
// })

// module.exports = storage;


// const multer = require('multer');
// const path = require('path');

// const getStorage = (folder) =>
//   multer.diskStorage({
//     destination: (req, file, cb) => {
//       cb(null, path.join(__dirname, `../../Public/uploads/${folder}`));
//     },
//     filename: (req, file, cb) => {
//       const ext = path.extname(file.originalname);
//       cb(null, Date.now() + '-' + file.fieldname + ext);
//     },
//   });

// // Export different uploaders
// const uploadProductImages = multer({ storage: getStorage('product-images') });
// const uploadRawImages = multer({ storage: getStorage('re-image') });
// const uploadProfileImage = multer({ storage: getStorage('profile') });

// module.exports = {
//   uploadProductImages,
//   uploadRawImages,
//   uploadProfileImage,
// };



//===================================
const multer = require('multer');
const path = require('path');

const getStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, `../Public/uploads/${folder}`));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + file.fieldname + ext);
    },
  });

const uploadProductImages = multer({ storage: getStorage('product-images') });
const uploadRawImages = multer({ storage: getStorage('re-image') });
const uploadProfileImage = multer({ storage: getStorage('profile') });

module.exports = {
  uploadProductImages,
  uploadRawImages,
  uploadProfileImage,
};