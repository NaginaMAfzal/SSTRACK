import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import Model from '../Models/Model';

const createToken = (user, res, next) => {
    const { id, email, name, userType, imageUrl } = user;
    const payload = {
        _id: id,
        email,
        name,
        userType,
        imageUrl,
    };

    // create a token
    jwt.sign(
        payload,
        process.env.JwtSecret, {
            expiresIn: '365d',
        },
        (err, token) => {
            // Error Create the Token
            if (err) {
                res.status(500);
                next(new Error('Unable to generate Token.'));
            } else {
                // Token Created
                res.json({
                    token,
                });
            }
        },
    );
};

const adminSignin = (req, res, next) => {
    // Find user with the passed email
    const { email, password } = req.body;
    // Find user with the passed email
    Model.UserModel.findOne({ email }).then(user => {
        if (user) {
            // if email found compare the password
            bcryptjs.compare(password, user.password).then(result => {
                // if password match create payload
                if (result) {
                    createToken(user, res, next);
                } else {
                    res.status(400);
                    next(new Error('Invalid Password'));
                }
            });
        } else {
            // Wrong Password.
            res.status(400);
            next(new Error('No User Exist With This Email'));
        }

    });
};

export default adminSignin;