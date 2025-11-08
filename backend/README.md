# Backend API

This is a Go-based API that lists images from a Cloudflare R2 or AWS S3 bucket.

## Configuration

The API is configured using environment variables.

| Variable              | Description                                     |
| --------------------- | ----------------------------------------------- |
| `BUCKET_NAME`         | The name of your R2/S3 bucket.                  |
| `R2_ACCOUNT_ID`       | Your Cloudflare account ID. (Not needed for S3) |
| `R2_ACCESS_KEY_ID`    | Your R2/S3 access key ID.                       |
| `R2_SECRET_ACCESS_KEY`| Your R2/S3 secret access key.                   |
| `R2_PUBLIC_URL`       | The public URL of your bucket.                  |

## Running the Application

1.  **Build the frontend:**

    ```bash
    cd ../frontend
    npm install
    npm run build
    cd ../backend
    ```

2.  **Set the environment variables:**

    ```bash
    export BUCKET_NAME=your-bucket-name
    export R2_ACCOUNT_ID=your-account-id
    export R2_ACCESS_KEY_ID=your-access-key-id
    export R2_SECRET_ACCESS_KEY=your-secret-access-key
    export R2_PUBLIC_URL=https://your-public-bucket-url
    ```

3.  **Run the server:**

    ```bash
    go run main.go
    ```

The application will be available at `http://localhost:8080`.
