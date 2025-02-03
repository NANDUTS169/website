
const errorHandling = (req,res,next) => {
    return res.redirect('/pageNotFound')
}


module.exports = {
    errorHandling
}