const isUserLoggedIn = (req,res,next) => {
    console.log("kjhsdkjf");
    console.log("session",req.session)
    if(req.session.user) {
        console.log("00000000",req.session.user)
        next();
    } else {
        res.redirect('/login');
    }
};

module.exports = {
    isUserLoggedIn
};