include ../.env
export $(shell sed 's/=.*//' ../.env)

init:
	terraform init

init-reconfigure:
	terraform init -reconfigure

init-upgrade:
	terraform init -upgrade

test:
	echo $(TF_VAR_SSH_FINGERPRINT)

plan:
	terraform plan

plan-cd:
	terraform plan -no-color -out=tfplan

refresh:
	terraform refresh

apply:
	terraform apply
	
# apply-cd:
# 	terraform apply -auto-approve -input=false -no-color tfplan

apply-cd:
	terraform apply -auto-approve -input=false -no-color 

destroy: 
	terraform destroy

taint-all:
	module=$1\
	for resource in `terraform show -module-depth=1 | grep module.${module} | tr -d ':' | sed -e 's/module.${module}.//'`; do\
		terraform taint -module ${module} ${resource}\
	done

taint:
	exit 1
	taint digitalocean_app.fos_app

list: 
	terraform state list

setup-workspaces:
	terraform workspace new dev
	terraform workspace new prod

workspace-dev:
	terraform workspace select dev

workspace-prod:
	terraform workspace select prod
