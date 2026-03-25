# Hostel Booking Portal

This project now supports two environments:

- Local XAMPP/Apache with PHP and MySQL using `submit_application.php`
- Vercel production using a Node.js serverless function at `api/submit-application/index.js`

## Local XAMPP

1. Put this folder inside your XAMPP `htdocs` directory.
2. Start Apache and MySQL in XAMPP.
3. Open `http://localhost/<folder-name>/`.
4. Submit the form. The PHP app will create the local database and table automatically.

The local PHP database defaults are defined in `db.php`:

- host: `localhost`
- port: `3306`
- username: `root`
- password: empty
- database: `hostel_booking_portal`

You can still import `database.sql` manually if you want, but it is no longer required for first run.

## GitHub

When Git is installed on your machine, run:

```powershell
git init
git add .
git commit -m "Prepare hostel portal for Vercel deployment"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Vercel

Vercel uses the Node.js function in `api/submit-application/index.js`.

The frontend uses:

- `submit_application.php` on `localhost`
- `/api/submit-application` on Vercel or another deployed domain

Before deploying, create:

- a hosted MySQL database reachable from Vercel
- a Vercel Blob store for uploaded files

Set these environment variables in Vercel:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_SSL`
- `BLOB_READ_WRITE_TOKEN`

If your MySQL provider gives you a connection string, you can use `DATABASE_URL` instead of the individual `MYSQL_*` variables.

Then deploy:

1. Push the repository to GitHub.
2. In Vercel, choose `Add New` -> `Project`.
3. Import the GitHub repository.
4. Add the environment variables before the first production deploy.
5. Deploy.

## Important Notes

- Local uploads are stored in `uploads/`.
- Vercel uploads are stored in Vercel Blob.
- The Vercel deployment will not use the local XAMPP database.
- Your hosted database must already exist before the Vercel function connects to it.
