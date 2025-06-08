import { useEffect, useState } from 'react'
import imageUrl from '@/assets/space-1278869_1920.jpg';
// import Background2 from '../background2';

import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Checkbox } from '../ui/checkbox';
import { Toaster } from "@/components/ui/toaster"
// import { Textarea } from '../ui/textarea';

export default function Register() {
    
  const { toast } = useToast()
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [email, setEmail] = useState('')
  const [invalidEmail, setInvalidEmail] = useState(false)
  const [validEmail, setValidEmail] = useState(false)
  const [name, setName] = useState('')
  const [options, setOptions] = useState({
    use: false,
    contribute: false,
    invest: false,
    // donate: false,
    info: false
  })
  // Add state for the hidden Zoho form
  const [zohoForm, setZohoForm] = useState<HTMLFormElement | null>(null)
  
  // Setup the hidden Zoho form
  useEffect(() => {
    // Create the hidden form container
    const formContainer = document.createElement('div')
    formContainer.style.display = 'none'
    formContainer.innerHTML = `
      <form name='WebToLeads6540102000000492949' 
            action='https://crm.zoho.com/crm/WebToLeadForm'
            method='POST' 
            onSubmit='javascript:document.charset="UTF-8";'>
        <input type='text' style='display:none;' name='xnQsjsdp' value='4a95627f26f00a2ac14375b64526eb7381f7da4b309c698c282d293c5b69d725'></input> 
        <input type='hidden' name='zc_gad' id='zc_gad' value=''></input>
        <input type='text' style='display:none;' name='xmIwtLD' value='71c5f83fdb7f04bec8cc16841eafbe4069c8f3697458f58ccacba4e32cb05e7bf0a928064183f391025abf8d22580476'></input> 
        <input type='text' style='display:none;' name='actionType' value='TGVhZHM='></input>
        <input type='text' style='display:none;' name='returnURL' value='https://info.fosforescent.com'></input>
        <input type='text' id='Last_Name' name='Last Name'></input>
        <input type='text' id='First_Name' name='First Name'></input>
        <input type='text' id='Description' name='Description'></input>
      </form>
    `
    document.body.appendChild(formContainer)
    setZohoForm(formContainer.querySelector('form'))

    // Cleanup on unmount
    return () => {
      document.body.removeChild(formContainer)
    }
  }, [])

  // Shadow update Zoho form fields as user types
  useEffect(() => {
    if (zohoForm) {
      const lastNameInput = zohoForm.querySelector('[name="Last Name"]') as HTMLInputElement
      if (lastNameInput) lastNameInput.value = email
    }
  }, [email, zohoForm])

  useEffect(() => {
    if (zohoForm) {
      const firstNameInput = zohoForm.querySelector('[name="First Name"]') as HTMLInputElement
      if (firstNameInput) firstNameInput.value = name
    }
  }, [name, zohoForm])

  useEffect(() => {
    if (zohoForm) {
      const descInput = zohoForm.querySelector('[name="Description"]') as HTMLInputElement
      if (descInput) {
        descInput.value = Object.keys(options)
          .filter(key => options[key as keyof typeof options])
          .join(', ')
      }
    }
  }, [options, zohoForm])

  const submitFields = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    if (!validEmail) {
      setInvalidEmail(true)
      return
    }

    try {
      // Submit the hidden Zoho form if it exists
      if (zohoForm) {
        zohoForm.submit()
      }

      toast({
        description: "Thank you for submitting your information.",
        duration: 9000,
      })
      setHasSubmitted(true)

    } catch (error) {
      console.error('Error submitting form:', error)
      toast({
        description: "There was an error submitting your information. Please try again.",
        duration: 9000,
      })
    }
  }


  const emailChangeHandle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const match = e.target.value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i)
    if (match) {
      setValidEmail(true)
    } else {
      setValidEmail(false)
    }
    setEmail(e.target.value)
    invalidEmail && setInvalidEmail(false)
    
  }

  return (
    <div   style={{
      width: '100%',
      boxSizing: 'border-box',
      backgroundImage: `url('${imageUrl}')`,
      backgroundColor: 'transparent',
      backgroundSize: 'cover',
      opacity: 1,
      position: 'relative',
    }} className="content-container">
    <script id='wf_anal' src='https://crm.zohopublic.com/crm/WebFormAnalyticsServeServlet?rid=12a6146e446e7ae70a5c16fd8400a93a170bb7befb3ec9d35a4bf705f81747159ebd17b9f215ca18fe1388c615694fbegid83a55e6457a2a393ba778f1e8d2fca40f72422d1fda1a0fac7c7651c7fe2aba9gida25ad5bc04e78d8241d5557155394c3e7c4b943224fd11b18225d6b675b9ee4agide36b130abc1f9185f7c9fea0d12e5897681d9e308433d6d7df9d8bd82fa9a823&tw=eb273774122ecfaf7ed9d508ad60702f95adcb04fda78deca7260593f41de347'></script>
    <div className="register-content" style={{
      zIndex: 7,
      // position: 'absolute',
      // top: 0,
      // left: 0,    
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      position: "relative",
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',      
      }}>

        <div style={{
          padding: '30px',
          backgroundColor: 'rgba(0,0,0,.5)',
          // marginTop: "33vh",   
        }} className="items-center">
 
        {hasSubmitted ? 
          <div>
            <h1> You have submitted your information</h1>
          </div>
        :(
          <form action="none">
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            width: "80%",
            margin: '0 auto',

          }}>
            <div style={{
              flexGrow: 1,
              flexBasis: '60%',
              width: '80%',
              minWidth: "200px",

              padding: '.5rem',
            }}>
            <Input placeholder="Email" className={`bg-transparent ${email ? 'border-white' : 'border-fosred'} ${!validEmail ? 'focus-visible:border-fosorange' : 'focus-visible:border-foswhite'} focus-visible:ring-transparent ring-white outline-none focus:ring-0`} value={email} onChange={emailChangeHandle} /> 
            {invalidEmail && <div className="text-fosred text-left">Invalid Email</div>}
            </div>
            <div style={{
              maxWidth: '100%',
              flexBasis: "150px",
              flexGrow: 1,
              width: "20%",
              minWidth: "150px",
              padding: '.5rem', 
            }}>
            <Button variant="outline" className={`bg-transparent ${validEmail ? 'border-fosgreen' : 'border-white'}`} onClick={submitFields}>Get Notified</Button>
            </div>
          </div>
          <div style={{
            margin: '0 auto',
            // padding: '3rem',
            
          }} className={`w-full tagalong-form ${email.length > 0 && !hasSubmitted ? 'is-visible' : 'is-hidden'} `}>
            <div style={{
              padding: '3rem',
              paddingBottom: '0',
            }} className='grid grid-cols-1 md:grid-cols-2'>

              <div style={{
                flexBasis: '50%',
                minWidth: '50%',
              }} className="col-start-1">
                <Input placeholder="Name" className="bg-transparent border-white focus-visible:ring-transparent" value={name} onChange={(e) => setName(e.target.value)} />
                {/* <Textarea placeholder="message" className="bg-transparent border-white focus-visible:ring-none" value={message} onChange={(e) => setMessage(e.target.value)} /> */}
              <br />
              </div>
              <div className='lg:grid-cols-1 grid-cols-1' style={{
                display: 'flex',
                maxWidth: "100%",
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                <div style={{
                  minWidth: '150px',
                  flexGrow: 1,
                }}>
                I want to:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3">
                <div className="text-left md:text-center" style={{
                  minWidth: '150px',
                  }}>
                  <Checkbox checked={options.use} onClick={() => setOptions({...options, use: !options.use})} /> Use
                </div>
                <div className="text-left md:text-center" style={{
                  minWidth: '150px',
                }}>
                  <Checkbox className="square" checked={options.contribute} onClick={() => { console.log('clicked'); setOptions({...options, contribute: !options.contribute})} }  /> Contribute
                </div>
                {/* <div>
                  <Checkbox checked={options.invest} onChange={(e) => setOptions(e)} />
                </div> */}
                <div className="text-left md:text-center" style={{
                  minWidth: '150px',
                }}>
                  <Checkbox checked={options.info} onClick={() => setOptions({...options, info: !options.info})} /> Get Info
                </div>

                </div>
              </div>
            </div>

          </div>
          </form>)}
        </div>

        <Toaster />
    </div>


    <div  style={{
      width: '100%',
      height: "100%",
      boxSizing: 'border-box',
      background: `radial-gradient(circle at 40% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 33%, rgba(224,114,29,.05) 40%, rgba(0,0,0,0) 50%, rgba(0,0,0,0) 100%) `,
      backgroundSize: 'cover',
      zIndex: 3,
      position: 'absolute',
      top: 0,
      left: 0,
      }}>

      &nbsp;

    </div>

    <div  style={{
      width: '100%',
      height: "100%",
      boxSizing: 'border-box',
      backgroundImage: `radial-gradient(circle at 60% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 33%, rgba(214,214,29,.05) 40%, rgba(0,0,0,0) 50%, rgba(0,0,0,0) 100%)`,
      backgroundSize: 'cover',
      zIndex: 4,
      position: 'absolute',
      top: 0,
      left: 0,
      }}>

      &nbsp;
    </div>
 
    <div  style={{
      width: '100%',
      height: "100%",
      boxSizing: 'border-box',
      backgroundImage: `radial-gradient(circle at 60% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,.6) 100%)`,
      backgroundSize: 'cover',
      zIndex: 5,
      position: 'absolute',
      top: 0,
      left: 0,
      }}>

      &nbsp;
    </div>
 
{/* 	
      <Background2 style={{

      }} /> */}
    </div>
  )
}

