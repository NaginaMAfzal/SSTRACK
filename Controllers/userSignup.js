import bcryptjs from 'bcryptjs';
import Model from '../Models/Model';
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const Sib = require('sib-api-v3-sdk');
require('dotenv').config();

// Configure the API client
const client = Sib.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.API_KEY;

const apiInstance = new Sib.TransactionalEmailsApi();

const userSignUpold = async (req, res, next) => {
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
        // Remove spaces and dots from the company name
        const cleanedCompany = company.replace(/[ .]/g, '');

        // Check if the provided email matches the expected format
        // if (!emailRegex.test(email)) {
        //   return res.status(400).json({ message: 'Invalid email format' });
        // }
        const existingUser = await Model.UserModel.findOne({ email: { $regex: new RegExp(`^${cleanedEmail}$`, 'i') } });

        if (existingUser) {
            res.status(400).json({ success: false, message: 'Email Already Taken.' });;
            return next(new Error('Email Already Taken.'));
        }

        // Check if a user with admin privilege has already registered a company
        if (userType === 'owner') {
            const existingCompany = await Model.UserModel.findOne({
                $or: [
                    { company: { $regex: new RegExp(`^${company}$`, 'i') } }, // Original company name
                    { company: { $regex: new RegExp(`^${cleanedCompany}$`, 'i') } } // Cleaned company name
                ],
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

        bcryptjs.hash(password, 12).then(async (hashedpassword) => {
            const User = new Model.UserModel({
                name,
                password: hashedpassword,
                email: cleanedEmail,
                company,
                userType,
                timezone,
                timezoneOffset,
            });

            try {
                const sendSmtpEmail = new Sib.SendSmtpEmail();
                sendSmtpEmail.subject = 'Your reset password verification code is here';
                sendSmtpEmail.sender = { name: 'SSTRACK', email: 'contact@sstrack.io' };
                sendSmtpEmail.to = [{ email: normalizedEmail, name: user.name }];
                sendSmtpEmail.htmlContent = `<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                    <h2 style="text-align: center; color: #333; font-size: 24px;">Reset Your Password</h2>
                    <p style="text-align: center; color: #555; font-size: 16px;">A request to reset your password has been received. Please use the code below to proceed:</p>
                    <div style="text-align: center; margin: 20px;">
                        <span style="font-size: 20px; background-color: #4CAF50; color: #fff; padding: 10px 20px; border-radius: 5px;">${number}</span>
                    </div>
                    <p style="text-align: center; color: #555; font-size: 16px;">
                        <strong>Note:</strong> This code will expire in 24 hours. Access the link before <strong>${new Date(otpTime).toLocaleString()}</strong>.
                    </p>
                    <p style="text-align: center; color: #555; font-size: 16px;">
                        If you have any questions or need further assistance, please contact us at:
                        <a href="mailto:support@sstrack.io" style="color: #0066cc;">support@sstrack.io</a> or call us at 
                        <a href="tel:+16479300988" style="color: #0066cc;">+1 647-930-0988</a>.
                    </p>
                </div>`;

                // Send email
                apiInstance.sendTransacEmail(sendSmtpEmail)
                    .then(async (data) => {
                        let SavedUser = await User.save()
                        console.log('Email sent successfully:', data);
                        res.status(200).json({ success: true, Message: 'Account Created Successfully.', SavedUser, });

                    })
                    .catch((error) => {
                        console.error('Error occurred:', error);
                        res.status(500).json({ success: false, message: 'Failed to Create new User' });
                    });

                // User.save()
                //     .then((SavedUser) => {
                //         console.log(SavedUser);
                //         return res.status(200).send({
                //             Message: 'Account Created Successfully.',
                //             SavedUser,
                //         });
                //     })
                //     .catch((err) => {
                //         res.status(500);
                //         next(
                //             new Error(
                //                 `Unable to Create User. Please Try later. ${err}`,
                //             ),
                //         );
                //     });
            } catch (error) {
                console.error('Error sending email:', error);
                res.status(500).json({ success: false, message: 'Failed to send email' });
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export default userSignUp;