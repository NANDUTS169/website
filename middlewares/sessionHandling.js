const isUserLoggedIn = (req,res,next) => {
    console.log("session",req.session)
    if(req.session.user) {
        console.log(req.session.user);
        next();
    } else {
        if(req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({error:"Unauthorized. Please login"});
        }
        res.redirect('/login');
    }
};

module.exports = {
    isUserLoggedIn
};