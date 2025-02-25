
// const errorHandling = (req,res,next) => {
//     return res.redirect('/pageNotFound')
// }


// module.exports = {
//     errorHandling
// }


// const errorHandling = (req,res,next) => {

//     console.log("OriginalURL: "+req.originalUrl);

//     if(req.originalUrl.startsWith("/admin")) {

//         console.log("admin error page printed");
//         return res.redirect("/admin/pageerror");

//     } else {
//         console.log("user error page printed")
//         return res.redirect("/pageNotFound");
        
//     }
// };

// module.exports = {
//     errorHandling,
// }




const errorHandling = (req, res, next) => {
    // console.log("Original URL:", req.originalUrl); 
    // console.log("Base URL:", req.baseUrl); 
    // console.log("Path:", req.path);

    // Ignore static files (JS, CSS, images)
    if (req.originalUrl.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/)) {
        return next(); 
    }

    // Check if the request is for an admin route
    if (req.baseUrl.startsWith("/admin")) {
        console.log("Admin error page printed");
        return res.redirect("/admin/pageerror");
    } else {
        console.log("User error page printed");
        return res.redirect("/pageNotFound");
    }
};

module.exports = {
    errorHandling,
};


