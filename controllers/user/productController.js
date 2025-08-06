const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");

const getUserProductList = async (req, res) => {
  try {
    // console.log("234567890",req.params.id)
    const products = await Product.find({
      isBlocked: false,
      status: "Available"
    }).sort({ createdOn: -1 });

    res.render("products", { products });  // must pass with key 'products'
  } catch (error) {
    console.error("Error loading products page:", error);
    res.redirect("/pageerror");
  }
}

// const getProductDetailPage = async (req,res) => {
//     try {
//         const productId = req.params.id
//         const productData = await Product.find({id:productId})
//         console.log("dsfa",productData)
//         console.log("sfd",req.params)
//         res.render("product-detail");
//     } catch (error) {
//         console.log("product detail page error",error);
//         res.redirect("pageNotFound");
//     }
// }

const getProductDetailPage = async (req, res) => {
    try {
        const productId = req.params.id;
        // console.log("Product ID:", productId);
        // Fetch product by ID and pass it to the view
        const product = await Product.findById(productId).populate('category');
      res.render("product-detail", { product });
    } catch (error) {
        console.log("Product detail page error:", error);
        res.redirect("/pageNotFound");
    }
};


module.exports = { 
    getUserProductList,
    getProductDetailPage,
}
