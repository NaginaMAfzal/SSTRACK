const isManagerOwner = (req, res, next) => {
    if (!req.user) {
        res.status(400).send({
            Message: 'Manager not logged In.',
        });
    } else if (req.user.userType == 'manager') {
        return next();
    } else {
        res.status(400).send({
            Message: 'This operation has restricted access.',
        });
    }
};

module.exports = {
    isManagerOwner,
};