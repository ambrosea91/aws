pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'staging', 'prod'],
            description: 'Select environment to deploy'
        )
        choice(
            name: 'ACTION',
            choices: ['plan', 'apply', 'destroy'],
            description: 'Terraform action to perform'
        )
        string(
            name: 'AWS_REGION',
            defaultValue: 'us-east-1',
            description: 'AWS Region'
        )
    }
    
    environment {
        TF_VERSION = '1.6.0'
        WORKING_DIR = '.'
        AWS_CREDENTIALS_ID = 'aws-credentials'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }
        
        stage('Setup Terraform') {
            steps {
                script {
                    echo "Installing Terraform ${env.TF_VERSION}..."
                    sh '''
                        # Download and install Terraform
                        wget -q https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_amd64.zip
                        unzip -o terraform_${TF_VERSION}_linux_amd64.zip
                        chmod +x terraform
                        sudo mv terraform /usr/local/bin/
                        rm terraform_${TF_VERSION}_linux_amd64.zip
                        
                        # Verify installation
                        terraform version
                    '''
                }
            }
        }
        
        stage('Terraform Init') {
            steps {
                dir("${env.WORKING_DIR}") {
                    withCredentials([
                        [
                            $class: 'AmazonWebServicesCredentialsBinding',
                            credentialsId: env.AWS_CREDENTIALS_ID,
                            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                        ]
                    ]) {
                        sh '''
                            export AWS_REGION=${AWS_REGION}
                            terraform init -reconfigure
                        '''
                    }
                }
            }
        }
        
        stage('Terraform Format Check') {
            steps {
                dir("${env.WORKING_DIR}") {
                    sh 'terraform fmt -check -recursive || true'
                }
            }
        }
        
        stage('Terraform Validate') {
            steps {
                dir("${env.WORKING_DIR}") {
                    sh 'terraform validate'
                }
            }
        }
        
        stage('Terraform Plan') {
            when {
                expression { params.ACTION == 'plan' || params.ACTION == 'apply' }
            }
            steps {
                dir("${env.WORKING_DIR}") {
                    withCredentials([
                        [
                            $class: 'AmazonWebServicesCredentialsBinding',
                            credentialsId: env.AWS_CREDENTIALS_ID,
                            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                        ],
                        string(credentialsId: 'db-password', variable: 'DB_PASSWORD')
                    ]) {
                        script {
                            sh """
                                export AWS_REGION=${params.AWS_REGION}
                                terraform plan \
                                    -var-file="environments/${params.ENVIRONMENT}.tfvars" \
                                    -var="db_password=\${DB_PASSWORD}" \
                                    -out=${params.ENVIRONMENT}.tfplan
                            """
                            
                            // Show plan summary
                            sh "terraform show -no-color ${params.ENVIRONMENT}.tfplan"
                        }
                    }
                }
            }
        }
        
        stage('Approval for Apply') {
            when {
                expression { params.ACTION == 'apply' }
            }
            steps {
                script {
                    def userInput = input(
                        id: 'Proceed',
                        message: "Apply Terraform changes to ${params.ENVIRONMENT}?",
                        parameters: [
                            booleanParam(
                                defaultValue: false,
                                description: 'Check to proceed with apply',
                                name: 'Confirm'
                            )
                        ]
                    )
                    
                    if (!userInput) {
                        error('User declined to proceed with apply')
                    }
                }
            }
        }
        
        stage('Terraform Apply') {
            when {
                expression { params.ACTION == 'apply' }
            }
            steps {
                dir("${env.WORKING_DIR}") {
                    withCredentials([
                        [
                            $class: 'AmazonWebServicesCredentialsBinding',
                            credentialsId: env.AWS_CREDENTIALS_ID,
                            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                        ]
                    ]) {
                        sh """
                            export AWS_REGION=${params.AWS_REGION}
                            terraform apply -auto-approve ${params.ENVIRONMENT}.tfplan
                        """
                    }
                }
            }
        }
        
        stage('Approval for Destroy') {
            when {
                expression { params.ACTION == 'destroy' }
            }
            steps {
                script {
                    def userInput = input(
                        id: 'ProceedDestroy',
                        message: "⚠️ DESTROY all resources in ${params.ENVIRONMENT}? This action cannot be undone!",
                        parameters: [
                            string(
                                defaultValue: '',
                                description: "Type 'destroy-${params.ENVIRONMENT}' to confirm",
                                name: 'ConfirmDestroy'
                            )
                        ]
                    )
                    
                    if (userInput != "destroy-${params.ENVIRONMENT}") {
                        error('Destroy confirmation did not match. Aborting.')
                    }
                }
            }
        }
        
        stage('Terraform Destroy') {
            when {
                expression { params.ACTION == 'destroy' }
            }
            steps {
                dir("${env.WORKING_DIR}") {
                    withCredentials([
                        [
                            $class: 'AmazonWebServicesCredentialsBinding',
                            credentialsId: env.AWS_CREDENTIALS_ID,
                            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                        ],
                        string(credentialsId: 'db-password', variable: 'DB_PASSWORD')
                    ]) {
                        sh """
                            export AWS_REGION=${params.AWS_REGION}
                            terraform destroy \
                                -var-file="environments/${params.ENVIRONMENT}.tfvars" \
                                -var="db_password=\${DB_PASSWORD}" \
                                -auto-approve
                        """
                    }
                }
            }
        }
        
        stage('Get Outputs') {
            when {
                expression { params.ACTION == 'apply' }
            }
            steps {
                dir("${env.WORKING_DIR}") {
                    withCredentials([
                        [
                            $class: 'AmazonWebServicesCredentialsBinding',
                            credentialsId: env.AWS_CREDENTIALS_ID,
                            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                        ]
                    ]) {
                        script {
                            sh """
                                export AWS_REGION=${params.AWS_REGION}
                                echo "=== Terraform Outputs ==="
                                terraform output
                                
                                echo "=== RDS Endpoint ==="
                                terraform output -raw db_endpoint || echo "Not available"
                                
                                echo "=== Connection Command ==="
                                terraform output -raw psql_command || echo "Not available"
                            """
                        }
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo "✅ Terraform ${params.ACTION} completed successfully for ${params.ENVIRONMENT} environment"
        }
        failure {
            echo "❌ Terraform ${params.ACTION} failed for ${params.ENVIRONMENT} environment"
        }
        always {
            // Clean up plan files
            dir("${env.WORKING_DIR}") {
                sh 'rm -f *.tfplan || true'
            }
            
            // Archive artifacts
            archiveArtifacts artifacts: "${env.WORKING_DIR}/*.tfplan", allowEmptyArchive: true
        }
    }
}
