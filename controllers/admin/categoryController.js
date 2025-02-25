const Category = require("../../models/categorySchema");


const categoryInfo = async (req, res) => {
    console.log("Entered category info function...");
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 1;
        const skip = (page - 1) * limit;

        console.log(page, limit, skip)

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

        console.log("rendered page successfully")
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};


const addCategory = async (req,res) => {    

    console.log("add Category function invoked...")
    const {name,description} = req.body;
    console.log(req.body)


    try {
        const existingCategory = await Category.findOne({name});
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
        return res.status(500).json({error:"Internal Server Error"});

    }
}


module.exports = {
    categoryInfo,
    addCategory,

}
