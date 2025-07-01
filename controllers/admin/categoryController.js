const mongoose = require("mongoose");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");


const categoryInfo = async (req, res) => {

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
        });

    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};


const addCategory = async (req,res) => {    

    console.log("add Category function invoked...")
    const {name,description} = req.body;

    try {

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp("^" + name + "$", "i")}
        });

        if(existingCategory){
            return res.status(400).json({error: "Category already exists"});
        }
        const newCategory = new Category({
            name,
            description,

        }) 
        console.log(newCategory);

        await newCategory.save();
        return res.json({message:"Category added successfully"});
        
    } catch (error) {
        console.log('Add Category error',error)
        return res.status(500).json({error:"Internal Server Error"});

    }
};

const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        // Validate categoryId first
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ status: false, message: "Invalid Category ID" });
        }

        // Validate percentage
        if (isNaN(percentage) || percentage < 0) {
            return res.status(400).json({ status: false, message: "Invalid percentage value" });
        }

        // Find category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        console.log("percentage:", percentage, "categoryId:", categoryId, "category:", category);

        // Find products under the category
        const products = await Product.find({ category: category._id });
        console.log("Products:", products);

        if (!products.length) {
            return res.json({ status: false, message: "No products found in this category" });
        }

        // Check if any product has a higher offer
        const hasProductOffer = products.some((product) => product.productOffer > percentage);
        console.log("Has higher product offer?", hasProductOffer);

        if (hasProductOffer) {
            return res.json({ status: false, message: "Products within this category already have higher product offers" });
        }

        // Update category offer
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

        // Reset product offers and update sale price
        for (const product of products) {
            product.productOffer = 0;
            product.salePrice = product.regularPrice;
            await product.save();
        }

        res.json({ status: true });

    } catch (error) {
        console.error("Internal Server Error:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


// const addCategoryOffer = async (req,res) => {
//     try {
//         const percentage = parseInt(req.body.percentage);
//         const categoryId = req.body.categoryId;
//         const category = await Category.findById(categoryId);

//         console.log("percentage: "+percentage, "categoryid: "+categoryId, "category: "+category);

//         // *****************************************
//         if (isNaN(percentage) || percentage < 0) {
//             return res.status(400).json({ status: false, message: "Invalid percentage value" });
//         }
//         // *****************************************
        
//         if(!category){
//             return res.status(404).json({status:false , message:"Category not found"});
//         }

//         const products = await products.find({category:category._id});

//         console.log(typeof(products));

//         console.log(products);

//         const hasProductOffer = products.some((product) => product.productOffer > percentage);

//         console.log(hasProductOffer);

//         // *************************************
//         if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//             return res.status(400).json({ status: false, message: "Invalid Category ID" });
//         }
//             // ************************************

//         if(hasProductOffer){
//             return res.json({status:false, message: "Products within this category already have product offers"});
//         }
//         await Category.updateOne({_id:categoryId},{$set: {categoryOffer:percentage}});

//         for(const product of products){
//             product.productOffer = 0;
//             product.salePrice = product.regularPrice;
//             await product.save();
//         }
//         res.json({status:true});

//     } catch (error) {
//         res.status(500).json({status: false, message: "Internal Server Error"});
//         console.log("Internal server error printed....",error);
//     }
// };


// const addCategoryOffer = async (req, res) => {
//     try {
//         const percentage = parseInt(req.body.percentage);
//         const categoryId = req.body.categoryId;

//         // Validate categoryId first
//         if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//             return res.status(400).json({ status: false, message: "Invalid Category ID" });
//         }

//         // Validate percentage
//         if (isNaN(percentage) || percentage < 0) {
//             return res.status(400).json({ status: false, message: "Invalid percentage value" });
//         }

//         // Find category
//         const category = await Category.findById(categoryId);
//         if (!category) {
//             return res.status(404).json({ status: false, message: "Category not found" });
//         }

//         console.log("percentage:", percentage, "categoryId:", categoryId, "category:", category);

//         // Find products under the category
//         const products = await Product.find({ category: category._id });
//         console.log("Products:", products);

//         if (!products.length) {
//             return res.json({ status: false, message: "No products found in this category" });
//         }

//         // Check if any product has a higher offer
//         const hasProductOffer = products.some((product) => product.productOffer > percentage);
//         console.log("Has higher product offer?", hasProductOffer);

//         if (hasProductOffer) {
//             return res.json({ status: false, message: "Products within this category already have higher product offers" });
//         }

//         // Update category offer
//         await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

//         // Reset product offers and update sale price
//         for (const product of products) {
//             product.productOffer = 0;
//             product.salePrice = product.regularPrice;
//             await product.save();
//         }

//         res.json({ status: true });

//     } catch (error) {
//         console.error("Internal Server Error:", error);
//         res.status(500).json({ status: false, message: "Internal Server Error" });
//     }
// };



const removeCategoryOffer = async (req,res) => {
    try {
        
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if(!category){
            return res.status(404).json({status:false, message:"Category not found"});

        }

        const percentage = category.categoryOffer;
        const products = await Product.find({category:category._id});

        if(products.length > 0){
            for(const product of products){
                product.salePrice += Math.floor(product.regularPrice * (percentage/100));
                product.productOffer = 0;
                await product.save();
            }
        }
        category.categoryOffer = 0;
        await category.save();
        res.json({status:true});
    } catch (error) {
        res.status(500).json({status:false,message:"Internal Server Error"});
    }
}

const getListCategory = async (req,res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category");
    } catch (error) {
       res.redirect("/pageerror");
    }
}

const getUnlistCategory = async(req,res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect("/admin/category");

    } catch (error) {
        res.redirect("/pageerror");
    }
}


const getEditCategory = async (req,res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("editCategory",{category:category});

    } catch (error) {
        res.redirect("/pageerror");
    }
};

const editCategory = async (req,res) => {
    try {
        const id = req.params.id;
        const {categoryName,description} = req.body;
        const existingCategory = await Category.findOne({
            _id: {$ne: id},
            name: {$regex: new RegExp("^" + categoryName + "$","i")}
        });

        if(existingCategory){
            return res.redirect(`/admin/editCategory?id=${id}&error=exists`);
            // return res.status(400).json({error: "Category exists, please choose another name"});
        }


        const updateCategory = await Category.findByIdAndUpdate(id,{
            name: categoryName,
            description: description,
        },{new:true});

        if(updateCategory){
            res.redirect(`/admin/editCategory?id=${id}&updated=1`);
        }else {
            res.status(404).json({error:"Category not found"});
        }
    } catch (error) {
        console.log("Edit Category Error:",error);
        res.status(500).json({error:"Internal server error"});
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
};