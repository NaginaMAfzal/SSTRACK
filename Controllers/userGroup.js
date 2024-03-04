import status from 'http-status';
import UserGroupSchema from '../Models/userGroupSchema';
import ProjectSchema from '../Models/projectSchema';
import User from '../Models/Model';

const getUserGroups = (req, res) => {
    UserGroupSchema.find()
        .then(events => {
            res.status(status.OK).send(events);
        })
        .catch(err => {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'No Events!',
                err,
            });
        });
};
const addEmployeeToUserGroup = async(req, res) => {
    const { groupId } = req.params;
    const { userIds } = req.body;

    try {
        // Check if all userIds exist in the User collection
        const users = await User.UserModel.find({ _id: { $in: userIds } });
        if (users.length !== userIds.length) {
            return res.status(400).send({ message: 'One or more user IDs do not exist.' });
        }

        // Update the group by adding the userIds
        const updatedGroup = await UserGroupSchema.findByIdAndUpdate(
            groupId, { $addToSet: { userId: { $each: userIds } } }, { new: true, useFindAndModify: false }
        );

        if (!updatedGroup) {
            return res.status(404).send({ message: 'Group not found.' });
        }

        res.send(updatedGroup);
    } catch (error) {
        console.error('Error updating the group:', error);
        res.status(500).send({ message: 'Internal server error.' });
    }


};

const allowUserToTrackTime = async(req, res) => {
    const { projectId, userId } = req.params;
    const { allowTracking } = req.body; // boolean indicating whether tracking should be allowed

    try {
        const project = await ProjectSchema.findById(projectId);

        if (!project) {
            return res.status(404).send({ message: 'Project not found.' });
        }

        if (!project.userId.includes(userId)) {
            return res.status(404).send({ message: 'User not found in this project.' });
        }

        if (allowTracking && !project.allowedEmployees.includes(userId)) {
            // If tracking is to be allowed and user is not already in the list, add them
            project.allowedEmployees.push(userId);
        } else if (!allowTracking && project.allowedEmployees.includes(userId)) {
            // If tracking is not to be allowed and user is in the list, remove them
            project.allowedEmployees = project.allowedEmployees.filter(id => id.toString() !== userId);
        }

        await project.save();

        res.send({ success: true, message: 'Updated time tracking permission successfully.' });
    } catch (error) {
        console.error('Error updating time tracking permission:', error);
        res.status(500).send({ message: 'Internal server error.' });
    }
};
const addClientToProject = async(req, res) => {
    const { projectId } = req.params;
    const { clientId } = req.body;

    try {
        // Check if the project exists
        const project = await ProjectSchema.findById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        // Check if the client exists and is of type 'client'
        const client = await User.UserModel.findOne({ _id: clientId, userType: 'client' });
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        // Check if the project already has a client assigned
        if (project.clientId) {
            return res.status(400).json({ success: false, message: 'Project already has a client assigned' });
        }

        // Assign the client to the project
        project.clientId = clientId;
        await project.save();

        return res.status(200).json({ success: true, message: 'Client added to the project' });
    } catch (error) {
        console.error('Error adding client to project:', error);
        return res.status(500).json({ success: false, message: 'Failed to add client to project' });
    }
};


const addEmployeeToProject = async(req, res) => {
    const { pId } = req.params;
    const { userIds } = req.body;

    try {
        // Check if all userIds exist in the User collection
        const users = await User.UserModel.find({ _id: { $in: userIds } });
        if (users.length !== userIds.length) {
            return res.status(400).send({ message: 'One or more user IDs do not exist.' });
        }

        // Update the project by adding the userIds
        const updatedProject = await ProjectSchema.findByIdAndUpdate(
            pId, { $addToSet: { userId: { $each: userIds } } }, { new: true, useFindAndModify: false }
        );

        if (!updatedProject) {
            return res.status(404).send({ message: 'Project not found.' });
        }

        // Update the user schema by adding the projectId
        await User.UserModel.updateMany({ _id: { $in: userIds } }, { $addToSet: { projectId: pId } });

        res.send(updatedProject);
    } catch (error) {
        console.error('Error updating the Project:', error);
        res.status(500).send({ message: 'Internal server error.' });
    }
};


const removeEmployeeFromUserGroup = async(req, res) => {
    const { gId } = req.params;
    const { userId } = req.body;

    try {
        // Check if the userId exists in the User collection
        const user = await User.UserModel.findById(userId);
        if (!user) {
            return res.status(400).send({ message: 'User ID does not exist.' });
        }

        // Find the group
        const group = await UserGroupSchema.findById(gId);

        if (!group) {
            return res.status(404).send({ message: 'Group not found.' });
        }

        // Check if the user is in the group
        const userIndex = group.userId.findIndex(id => id.toString() === userId);

        if (userIndex === -1) {
            return res.status(400).send({ message: 'User not in the group.' });
        }

        // Remove the user from the group
        group.userId.splice(userIndex, 1);
        await group.save();

        res.send(group);
    } catch (error) {
        console.error('Error updating the group:', error);
        res.status(500).send({ message: 'Internal server error.' });
    }
};




const addUserGroup = (req, res) => {
    const { name } = req.body;

    const event = new UserGroupSchema({
        name,

    });
    event
        .save()
        .then(savedEvent => {
            res.status(status.OK).send({
                savedEvent,
                Message: 'Event Created Successfully',
                type: status.Ok,
            });
        })
        .catch(err => {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: status.INTERNAL_SERVER_ERROR,
                err,
            });
        });
};
const countEmployeesInProject = async(projectId) => {
    try {
        // Find the project by its ID
        const project = await ProjectSchema.findById(projectId);

        if (!project) {
            return 0; // Project not found
        }

        // Count the employees associated with the project
        // eslint-disable-next-line no-underscore-dangle
        const employeeCount = await User.UserModel.countDocuments({ projectId: project._id });

        return employeeCount;
    } catch (error) {
        console.error('Error counting employees in project:', error);
        throw error;
    }
};
const removeEmployeeFromProject = async(req, res) => {
    const { pId } = req.params;
    const { userId } = req.body;

    try {
        // Check if the userId exists in the User collection
        const user = await User.UserModel.findById(userId);
        if (!user) {
            return res.status(400).send({ message: 'User ID does not exist.' });
        }

        // Find the group
        const project = await ProjectSchema.findById(pId);

        if (!project) {
            return res.status(404).send({ message: 'project not found.' });
        }

        // Check if the user is in the group
        const userIndex = project.userId.findIndex(id => id.toString() === userId);

        if (userIndex === -1) {
            return res.status(400).send({ message: 'User not in the project.' });
        }

        // Remove the user from the group
        project.userId.splice(userIndex, 1);
        await project.save();

        res.send(project);
    } catch (error) {
        console.error('Error updating the Project:', error);
        res.status(500).send({ message: 'Internal server error.' });
    }
};
const deleteEvent = (req, res) => {
    const { id } = req.params;
    UserGroupSchema.findByIdAndRemove(id, (err, result) => {
        console.log(id);
        if (result) {
            res.status(status.OK).send({
                Message: 'Event Deleted Successfully.',
            });
        } else {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Delete.',
                err,
            });
        }
    });
};

const EmployeeRoleUpdate = (req, res) => {
    const { id } = req.params;
    const query = { $set: req.body };
    User.UserModel.findByIdAndUpdate(id, query, { new: true }, (err, result) => {
        if (err) {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Update.',
            });
        } else {
            res.status(status.OK).send({
                Message: 'Successfully Updated.',
                result,
            });
        }
    });
};

const getSingleEvent = (req, res) => {
    const { eid } = req.params;

    UserGroupSchema.findOne({ _id: eid })
        .then(event => {
            if (!event) {
                return res.status(status.NOT_FOUND).send({
                    Message: 'Boat not found',
                });
            }
            return res.status(status.OK).send(event);
        })
        .catch(err => {
            return res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Internal Server Error',
                err,
            });
        });
};

export default { addUserGroup, deleteEvent, EmployeeRoleUpdate, getSingleEvent, countEmployeesInProject, removeEmployeeFromProject, addClientToProject, allowUserToTrackTime, getUserGroups, addEmployeeToUserGroup, addEmployeeToProject, removeEmployeeFromUserGroup };