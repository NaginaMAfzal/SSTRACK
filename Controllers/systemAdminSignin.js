import jwt from 'jsonwebtoken';
// import bcryptjs from 'bcryptjs';
// import Model from '../Models/systemAdminSchema';

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
	const { email, password } = req.body;
	if (email == 'admin@gmail.com' && password == 'qwerty000') {
		const user = {
			id: '5e944eb2b2badf1b984e7284',
			email: 'admin@gmail.com',
			name: 'Admin',
			userType: 'system Admin',
			imageUrl: 'https://buildnewgovt.s3.amazonaws.com/ryan.jpg',
		};
		createToken(user, res, next);
	} else {
		res.status(400);
		next(new Error('Invalid email or Password'));
	}
};

export default adminSignin;