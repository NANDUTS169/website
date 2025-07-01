const isUserLoggedIn = (req,res,next) => {
    if(req.session.user && req.session.user.isLoggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
};

module.exports = {
    isUserLoggedIn
};