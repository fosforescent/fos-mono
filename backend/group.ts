

// post - get market tasks, etc. for usergroup


// post - see services available for usergroup

export const queryUserByEmail = async (req: Request, res: Response) => {

    // get user profile if exists

}

export const queryUserByDisplayName = async (req: Request, res: Response) => {

    // fuzzy find users 

}

export const createGroup = async (req: Request, res: Response) => {

    // require group name? 

    // add group to DB (incl keys)

    // add group shadow node to creator's root context

    // add creator's shadow node as peer node

    // add group node as peer to shadow node? 

    // when user updates shadow node, group can see, 
    // when group node updates... ?? 


}

export const addUserToGroup = async (req: Request, res: Response) => {

    //

}


// post - see task requests available to usergroup (available to bid on .. how to distinguish from our tasks?)