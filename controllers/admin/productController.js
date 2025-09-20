const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { log } = require("console");

const getProductAddPage = async (req,res) => {
    try {
        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});
        res.render("product-add",{
            cat: category,
            brand: brand, 
        })
    } catch (error) {
        res.redirect("/pageerror");
        console.error(error);
    }
};

// const addProducts = async (req,res) => {
//     console.log("Add products funtion invoked...");
//     try {
//         const products = req.body;
//         // console.log(products)
//         const productExists = await Product.findOne({
//             productName: products.productName,
//         });
        
//         if(!productExists){
//             const images = [];

//             if(req.files && req.files.length>0){
//                 for(let i=0;i<req.files.length;i++){
//                     const originalImagePath = req.files[i].path;

//                     const resizedImagepath = path.join('Public','uploads','product-images',req.files[i].filename);
//                     await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagepath);
//                     images.push(req.files[i].filename); 
//                 }
//             }
//             const categoryId = await Category.findOne({name:products.category});

//             if(!categoryId){
//                 return res.status(400).json("Invalid category name")
//             }

//             const newProduct = new Product({
//                  productName: products.productName,
//                  description: products.description,
//                  brand:products.brand,
//                  category: categoryId._id,
//                  regularPrice: products.regularPrice,
//                  salePrice:products.salePrice,
//                  createdOn: new Date(),
//                  quantity: products.quantity,
//                  size:products.size,
//                  color:products.color ? products.color : 'undefined',
//                  productImage:images,
//                  status: 'Available',
//             });

//             console.log("product details to be saved: "+newProduct);
//             await newProduct.save();
//             return res.redirect("/admin/addProducts");

//         }else{
//             return res.status(400).json("Product already exist, please try with another name");
//         }
//     } catch (error) {
//         console.error("Error saving product",error);
//         return res.redirect("/admin/pageerror")
//     }
// }
const addProducts = async (req, res) => {
    try {
        const products = req.body;

        const productExists = await Product.findOne({
            productName: products.productName,
        });

        if (!productExists) {
            console.log('inside the condition');
            
            const images = [];

            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path; // from /re-image

                    // Resized filename and path (store in product-images folder)
                    const filename = Date.now() + '-' + req.files[i].originalname;
                    console.log("🚀 ~ addProducts ~ filename:", filename)
                    
                    const resizedImagePath = path.join(__dirname, '../../Public/uploads/product-images', filename);

                    // Resize and store
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                    images.push(filename);

                    console.log('consolelog inside the addproducts for loop')
                }
            }
            

            const categoryId = await Category.findOne({ name: products.category });

            if (!categoryId) {
                return res.status(400).json("Invalid category name");
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color || 'undefined',
                productImage: images,
                status: 'Available',
            });

            console.log("Product details to be saved: ", newProduct);
            await newProduct.save();
            return res.redirect("/admin/addProducts");

        } else {
            return res.status(400).json("Product already exists, please try with another name");
        }

    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageerror");
    }
}



const getAllProducts = async (req,res) => {
    try {
        const search = req.query || "";
        const page = req.query.page || 1;
        const limit = 20;

        const productData = await Product.find({
            $or:[
                {productName:{$regex: new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).limit(limit*1).skip((page-1)*limit).populate('category').exec();

        const count = await Product.find({
            $or:[
                {productName: {$regex:new RegExp(".*"+search+".*","i")}},
                {brand: {$regex: new RegExp(".*"+search+".*","i")}},
            ]
        }).countDocuments();

        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});

        if(category && brand){
            res.render("admin-products",{
                data: productData,
                currentPage: page,
                totalPages: page,
                totalpages: Math.ceil(count/limit),
                cat: category,
                brand: brand, 
            })
        }else{
            res.render("page-404"); 
        }

    } catch (error) {
        res.redirect("/pageerror"); 
    }
}

const addProductOffer = async (req,res) => {
    try {
        const {productId,percentage} = req.body;
        const findProduct = await Product.findOne({_id:productId});
        const findCategory = await Category.findOne({_id:findProduct.category});
        if(findCategory.categoryOffer>percentage){
            return res.json({status: false, msesage: "This products category has category Offer"}) 
        }

        findProduct.salePrice = findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.productOffer = parseInt(percentage);
        await findProduct.save();
        findCategory.categoryOffer=0;
        await findCategory.save();
        res.json({status:true}); 


    } catch (error) {
        res.redirect("/pageerror");
        res.status(500).json({status:false,message: "Internal Server Error"});
    }
};

const removeProductOffer = async (req,res) => {
    console.log("Remove product offer function invoked......")
    try {
        const {productId} = req.body
        const findProduct = await Product.findOne({_id:productId});
        const percentage = findProduct.productOffer;
        findProduct.salePrice = findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.productOffer = 0;
        await findProduct.save();
        res.json({status:true});  

    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
}

const blockProduct = async (req,res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/products");

    } catch (error) {
        res.redirect("/pageerror");
    }
}

const unblockProduct = async (req,res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products");

    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
}

const getEditProduct = async (req,res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({_id:id}).lean();
        const category = await Category.find({});
        const brand = await Brand.find({});
        res.render("product-edit",{
            product:product,
            cat: category,
            brand: brand,

        });
    } catch (error) {
        console.error(error);
        res.redirect('/pageerror');
    }
}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const product = await Product.findById(id);
    if (!product) return res.redirect("/admin/pageerror");

    const duplicate = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });

    if (duplicate) {
      return res.status(400).json({ error: "Product with this name already exists" });
    }

    // Update basic fields
    product.productName = data.productName;
    product.description = data.description;
    product.brand = data.brand;

    const categoryObj = await Category.findOne({ name: data.category });
    if (!categoryObj) return res.redirect("/admin/pageerror");

    product.category = categoryObj._id;
    product.regularPrice = data.regularPrice;
    product.salePrice = data.salePrice;
    product.quantity = data.quantity;
    product.size = data.size;
    product.color = data.color;

    // Handle new images (cropper uploads)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const resizedPath = path.join("public", "uploads", "product-images", file.filename);
        await sharp(file.path).resize({ width: 440, height: 440 }).toFile(resizedPath);

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path); // delete original file from re-image
        }

        product.productImage.push(file.filename); // append to existing array
      }
    }

    await product.save();
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error in editProduct:", error);
    res.redirect("/admin/pageerror");
  }
};


// const editProduct = async (req,res) => {
//     try {
//         const id = req.params.id;
//         const product = await Product.findOne({_id:id});
//         const data = req.body;
//         const existingProduct = await Product.findOne({
//             productName : data.productName,
//             _id:{$ne:id}
//         })
        
//         if(existingProduct){
//             return res.status(400).json({error:"product with this name already exists. Please try with another name"});
//         }

//         const images = [];

//         if(req.files && req.files.length>=0){
//             for(let i=0;i<req.files.length;i++){
//                 images.push(req.files[i].filename);
//             }
//         }

//         const updateFields = {
//             productName:data.productName,
//             description: data.description,
//             brand: data.brand,
//             category: data.category,
//             regularPrice: data.regularPrice,
//             salePrice: data.salePrice,
//             quantity: data.quantity,
//             size: data.size,
//             color: data.color,
//         }
//         if(req.files.length>0){
//             updateFields.$push = {productImage:{$each:images}};
//         }

//         await Product.findByIdAndUpdate(id,updateFields,{new:true});
//         res.redirect("/admin/products");
//     } catch (error) {
//         console.error(error);
//         res.redirect("/pageerror");
//     }
// }

const deleteSingleImage = async (req,res) => {
    console.log("delete single image backend function invoked..");
    try {
        const {imageNameToServer,productIdToServer} = req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
        const imagePath = path.join("public","uploads","product-images",imageNameToServer);
        console.log(imagePath);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        }else{
            console.log(`Image ${imageNameToServer} not found`);
        }
        res.send({status:true});

    } catch (error) {
        res.redirect("/pageerror");
        console.error(error);
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,

}
