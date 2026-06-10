const express = require('express')
const app = express()
const path = require('path')
const dotenv = require('dotenv');
const session = require("express-session")
const passport = require('./config/passport')
dotenv.config();
const db = require('./config/db')
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const errorHandling = require('./middlewares/errorHandling')
db()

app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}))

app.use(async (req, res, next) => {
    
    if (req.session.user) {
        try {
            const User = require('./models/userSchema');
            const Cart = require('./models/cartSchema');
            const Wishlist = require('./models/wishlistSchema');

            const userData = await User.findById(req.session.user);
            res.locals.user = userData || null;

            if (userData) {
                const cart = await Cart.findOne({ userId: userData._id });
                const wishlist = await Wishlist.findOne({ userId: userData._id });

                res.locals.cartCount = cart ? cart.items.length : 0;
                res.locals.wishlistCount = wishlist ? wishlist.items.length : 0;
            } else {
                res.locals.cartCount = 0;
                res.locals.wishlistCount = 0;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            res.locals.user = null;
            res.locals.cartCount = 0;
            res.locals.wishlistCount = 0;
        }
    } else {
        res.locals.user = null;
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());


app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.set("view engine", "ejs")

app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);
app.use(express.static(path.join(__dirname, "Public")));


app.use("/admin", adminRouter);
app.use("/", userRouter);

app.use(errorHandling.errorHandling);


const PORT = process.env.PORT || 3000;
app.listen(process.env.PORT, () => {
    console.log("Server running");
})

module.exports = app;
