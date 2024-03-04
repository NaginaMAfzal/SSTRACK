# Node Api for Screenshot Monitor App

# For local environment

```
npm install
nodemon
```

### the server is running on port 9094

## Add all sensitive information like API Keys, Db Uri and Secret Keys in .env file

## Cyclic .env account setuo

- add all .env variables in the vaiable section of deployed application configuration
  

## For Cyclic Server

```
https://tame-red-puppy-sari.cyclic.app/api/v1/

```

# Short description of api routes v1

# Main Routes V1

/api/v1/signin/ ---- for signing in employees (userrole based login) 
/api/v1/signup/ ---- for signing up employees 
/api/v1/superAdmin --- admin Operations
/api/v1/timetrack  --- All time tracking operations for an Employee
/api/v1/userGroup  --- All user group operations by admin
/api/v1/owner  --- All owner operations
/api/v1/manager  --- All Manager operations
/api/v1/SystemAdmin --- All System Admin operations



# Sub routes for Signup router

/api/v1/signup/ --- Signup for All Employees
/api/v1/signup/ownerSignUp --- SignUp for All system Admins

# Sub routes for SignIn router

/api/v1/signin/  --- SignIn Route for All employees and owner but with owner send 
/api/v1/signin/userStatus --- To update a user's online status (not using in project)
/api/v1/signin/userDelete/:id  --- delete My account 
/api/v1/signin/users/:id/last-active --- To update a user's last active status
(not using in project)
/api/v1/signin/userStatus-active --- To update user's current active status (not using in project)(checks every 5 minutes if a user is active or not)
/api/v1/signin/Update --- Update user settings 

/api/v1/signin/ownerSignIn  --- owner signIn  (not using in project) 



# sub routes for admin operations

/api/v1/superAdmin/addProject --- Add a new Project
/api/v1/superAdmin/           --- Get a list of all projects
/api/v1/superAdmin/:eid       --- Get a single project by id
/api/v1/superAdmin/employees  --- Get list of all employees
/api/v1/superAdmin/allUsersStatuses --- get list of all active employees (checks every 5 minutes is a employee is active or not) (not using in project) 
/api/v1/superAdmin/allEmployeesworkinghour -- get a list of all employees Daily,Weekly,Monthly and Yearly working hours with billing information 
/api/v1/superAdmin/allUsersWorkinghours --- get lists of all employees today's total working hours with  active status (not using in project) 
/api/v1/superAdmin/sorted-datebased/:userId --- get list of today's sorted screenshot for an employee
/api/v1/superAdmin/user/:id/time-records --- Each employee detailed record of daily , yesterday,weekly and monthly total working hours with billing information (not using in project)
/api/v1/superAdmin/deleteScreenshot/:screenshotId/TimeTracking/:timeTrackingId --- Delete a screenshot for an employee
/api/v1/superAdmin/UpdateBillingInfo/:userId --- Update payrate and currency for each employee
/api/v1/superAdmin/editCompanyName/:id --- update company name for an employee 
/api/v1/superAdmin/editCompanyNameForAllEmployee --- update company name for all employees (not using in project)
/api/v1/superAdmin/history/:userId           --- Get a list of all deleted screenshots of an employee (not using in project)
/api/v1/superAdmin/Settings/:userId           --- Get a list of all settings of an employee
/api/v1/superAdmin/archived/:userId               --- update an employees' archived status/pause
/api/v1/superAdmin/deleteEmp/:id                 --- delete an employee
/api/v1/superAdmin/settingsE/:userId             --- get each employees settings
/api/v1/superAdmin/activity/:eid                 --- get activity details for an employee
/api/v1/superAdmin/email              ---send email invite to users/employees (add sendgrid api)
/api/v1/superAdmin/client-email           --- send client emails
/api/v1/superAdmin/totalDate     --- random dates to calculate total hours --- pass in query as startDate and endDate
/api/v1/superAdmin/month      --- this month or previous month pass in query as  param value monthSpecifier
/api/v1/superAdmin/week     --- this week or previous week pass in query as this and previous 
/api/v1/superAdmin/annualRecord/:year    --- this year or previous year ---params if want this year 2023 - if want previous 2022

/api/v1/superAdmin/editProjectName/:projectId        ---edit a project's name
/api/v1/superAdmin/archiveProject/:projectId         ---archive a project 





# Routes for time tracking operations

/api/v1/timetrack/add --- start tracking time for a signedin employee
/api/v1/timetrack/ --- get daily working hours detailed report for a signedin employee (not using in project)
/api/v1/timetrack/sorted-screenshot --- detailed daily sorted screenshot for signedin employee 
/api/v1/timetrack/hours --- Dashboard Summary Daily, weekly , yesterday and monthly working hour summary with billing information
/api/v1/timetrack/edit/:timeEntryId ---  stop tracking time for a signedin employee
/api/v1/timetrack/time-entries/:timeEntryId/screenshots --- add screenshots for each time entry
/api/v1/timetrack/online-status --- employees online status on dashboard (not using in project)
/api/v1/timetrack/ReportActivity --- Update each employees timeline report
/api/v1/timetrack/Activities --- get each employee activity report
/api/v1/timetrack/split-activity  --- split activity for a user (not tested yet)
/api/v1/timetrack/totalDate   --- add random dates as startDate and endDate 
/api/v1/timetrack/month     --- this month or previous month pass in query as startDate and endDate param value monthSpecifier

/api/v1/timetrack/week     --- this  or previous week pass in query weekSpecifier param value 

/api/v1/timetrack/year     --- this or previous month pass in query  param value 


# Routes for User Group Managements

/api/v1/userGroup/add --- add a userGroup
/api/v1/userGroup/ --- Get a userGroup
/api/v1/userGroup/:eid --- get single UserGroup with given id
/api/v1/userGroup/delete/:gId --- remove an employee from userGroup with given usergroup id in params
/api/v1/userGroup/deleteProject/:pId  --- remove an employee from a project given project id in params
/api/v1/userGroup/edit/:id --- update an employee role as admin or manager
/api/v1/userGroup/addEmployeesToGroup/:groupId  --- add an employee to a group
/api/v1/userGroup/addEmployeesToProject/:pId --- add an employee to a specific project
/api/v1/userGroup/:projectId/employees/count  --- to count employees in a project
/api/v1/userGroup/allowTracking/:projectId/user/:userId  ---allow user to track time for a project
/api/v1/userGroup/addClientToProject/:projectId    ---add client to a project


# Sub routes for Manager router

 
/api/v1/manager/dashboard --- dashboard of manager
/api/v1/manager/managed-users/:managerId ---- user assigned to a manager
/api/v1/manager/datebasedusers/user/:userId    ---- getting user's timeline
/api/v1/manager/activity/:eid          ---- getting activity data with activity id
/api/v1/manager/deleteScreenshot/:screenshotId/TimeTracking/:timeTrackingId       --- deleting a screenshot
/api/v1/manager/addEmployeesToProject/:pId  --- add employees to project
/api/v1/manager/deleteProject/:pId --delete an employee from the project

 # Sub routes for owner router

 
/api/v1/owner/addEmployee --- add employees to company
/api/v1/owner/companies ---- total number of employees in a company and employees
/api/v1/owner/archived/:userId   --- delete/disable a user
/api/v1/owner/getDisabledEmployee ---get disabled employees 
/api/v1/owner/getCompanyemployee --- Dashboard total hours of all employees
/api/v1/owner/sorted-datebased/:userId   ---owner can view all his employees
/api/v1/owner/:eid --- single employee
/api/v1/owner/archived/:userId --- if u want to archive or unarchive a user


 # Sub routes for systemAdmin router



/api/v1/SystemAdmin/companies  --- get All companies
/api/v1/SystemAdmin/disabledCompanies     --- get disabled companies
/api/v1/SystemAdmin/archived/:userId     --- disbale/enable status of companies
/api/v1/SystemAdmin/getCompany/:com     --- get Employees on the basis of the company  



