/* eslint-disable no-underscore-dangle */
/* eslint-disable prefer-destructuring */
import User from '../Models/userSchema';

const checkUserArchivedStatus = async(req, res, next) => {
    const userId = req.user._id; // Assuming you have set the userId in the request object

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isArchived) {
            return res.status(403).json({ success: false, message: 'This user is archived and cannot track time' });
        }

        next();
    } catch (error) {
        console.error('Error checking user archived status:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export default checkUserArchivedStatus;