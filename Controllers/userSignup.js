import bcryptjs from 'bcryptjs';
import Model from '../Models/Model';



const userSignUp = async (req, res, next) => {
    try {
        const { name, password, email, company, userType, timezone, timezoneOffset } = req.body;

        const query = { email };
        // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regular expression for basic email format validation

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regular expression for basic email format validation

        // Check if the provided email matches the expected format and contains only one dot
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Split the email into local part and domain
        const [localPart, domain] = email.split('@');

        // Remove extra dots after the '@' symbol
        const domainParts = domain.split('.');
        if (domainParts.length > 2) {
            return res.status(400).json({ message: 'Invalid email format: More than one dot in the domain part' });
        }

        // Remove dots before the '@' symbol
        const cleanedLocalPart = localPart.replace(/\./g, ''); // Remove dots from local part
        const cleanedEmail = `${cleanedLocalPart}@${domain}`;
        // Check if the provided email matches the expected format
        // if (!emailRegex.test(email)) {
        //   return res.status(400).json({ message: 'Invalid email format' });
        // }
        const existingUser = await Model.UserModel.findOne({ email: cleanedEmail });

        if (existingUser) {
            res.status(400).json({ success: false, message: 'Email Already Taken.' });;
            return next(new Error('Email Already Taken.'));
        }

        // Check if a user with admin privilege has already registered a company
        if (userType === 'owner') {
            const existingCompany = await Model.UserModel.findOne({
                company: { $regex: new RegExp(`^${company}$`, 'i') }, // Case-insensitive check
                userType: 'owner',
            });

            if (existingCompany) {
                res.status(400);
                return next(new Error('Company Already Registered.'));
            }
        }

        bcryptjs.hash(password, 12).then((hashedpassword) => {
            const User = new Model.UserModel({
                name,
                password: hashedpassword,
                email: cleanedEmail,
                company,
                userType,
                timezone,
                timezoneOffset,
            });

            User.save()
                .then((SavedUser) => {
                    console.log(SavedUser);
                    return res.status(200).send({
                        Message: 'Account Created Successfully.',
                        SavedUser,
                    });
                })
                .catch((err) => {
                    res.status(500);
                    next(
                        new Error(
                            `Unable to Create User. Please Try later. ${err}`,
                        ),
                    );
                });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


export default userSignUp;