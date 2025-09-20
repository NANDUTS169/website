const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");

const getUserProductList = async (req, res) => {
  try {
    const products = await Product.find({
      isBlocked: false,
      status: "Available"
    }).sort({ createdOn: -1 });
    
    const count = await Product.countDocuments({
      status: "Available"
    });
    console.log("The total count of products",count);

    res.render("products", { products });
  } catch (error) {
    console.error("Error loading products page:", error);
    res.redirect("/pageerror");
  }
}

const getProductDetailPage = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category')
        
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
