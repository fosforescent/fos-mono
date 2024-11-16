import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,

  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useEffect, useState } from "react"
import { documents } from "../../assets"
import { AppState, FosReactOptions } from "@/fos-combined/types"

export function TermsDialog({
  open,
  setOpen,
  fromRegisterForm,
  setAcceptTerms
} : {
  open: boolean
  setOpen: (open: boolean) => void
  fromRegisterForm?: boolean
  setAcceptTerms: (accept: boolean) => void
  data: AppState,
  setData: (state: AppState) => void
  options: FosReactOptions
}) {






  const handleAccept = () => {
    setAcceptTerms(true)
    setOpen(false)
  }

  const handleReject = () => {
    setAcceptTerms(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="sm:max-w-[425px] max-h-96 overflow-y-hidden">
          <DialogTitle aria-description='Terms and Conditions'>Terms And Conditions</DialogTitle>
          <DialogDescription className="overflow-y-scroll">
            <span>SUBSCRIBER AGREEMENT</span>
            <p>
            <span>This Subscriber Agreement is between Sycamore Technology LLC, a Kentucky limited liability company 
            (&ldquo;Company&rdquo;) and the individual or organization agreeing to the terms of this Agreement (&ldquo;Customer&rdquo;), 
            and, together with all applicable exhibits, attachments, addenda, and Order Forms, is the complete agreement of the parties
            regarding Customer&rsquo;s use of the app services (the &ldquo;Agreement&rdquo;). This Agreement shall be effective on the 
            earliest of (a) the date Customer clicks a button indicating its agreement with the terms of this Agreement, 
            (b) the date Customer enters into an Order Form or other ordering document incorporating this Agreement, or (c) 
            Customer&rsquo;s use of the Service (the &ldquo;Effective Date&rdquo;). </span></p>
            <span>Definitions</span>
            <p><span>&ldquo;Affiliate&rdquo; means any entity that Controls, is Controlled by, or is under common 
            Control with the Company or the Customer entity agreeing to these terms, where &ldquo;Control&rdquo; means ownership of 
            more than 50% of the voting interests of the subject entity.</span></p>
            <p><span>&ldquo;Customer Data&rdquo; means all information th</span>
            <span>at Customer or its End Users submit to the Service.</span></p>
            <p><span>&ldquo;Documentation&rdquo; means Company&rsquo;s user guides, as updated from time to time, 
            accessible via the &ldquo;Help&rdquo; feature of the Service.</span></p><p><span>&ldquo;End User&rdquo; 
            means any individual who is authorized by Customer to use the Service under Customer&rsquo;s account, including Customer&rsquo;s 
            or its Affiliates&rsquo; employees, consultants, contractors, or agents.</span></p><p><span>&ldquo;Order 
            Form&rdquo; means an ordering document or an online order entered into between Customer and Company (or Affiliates of either party) 
            specifying the Service to be provided under this Agreement.</span></p><p><span>&ldquo;Service&rdquo; means 
            Company&rsquo;s software as a service platform.</span></p><p><span>&ldquo;Subscription&rdquo; means the access
            to the Service acquired by Customer on a per End User basis.</span></p><p><span>&ldquo;Subscription Term&rdquo;
            means the term identified in the applicable Order Form or other ordering document, including any renewal term, during which Customer&rsquo;s
            End Users are permitted to use the Service.</span></p><p><span>The Service</span><span>. </span>
            <span>Provision of the Service and Availability. Company will make the Service acquired under an Order Form or other ordering
            document available to Customer and its End Users during the applicable Subscription Term pursuant to this Agreement. Company may 
            update the content, functionality, and user interface of the Service from time to time in its sole discretion. Some features and 
            functionality may be available only with certain versions of the Service. Customer agrees that its acquisition of the Service under this 
            Agreement is not contingent on the delivery of future features or functionality.</span></p><p><span>Access Rights</span>
            <span>. Company grants to Customer a non-exclusive, non-sublicenseable, non-transferable (except as specifically permitted in 
            this Agreement) right to access and use the Service during the applicable Subscription Term pursuant to this Agreement, solely for 
            Customer&rsquo;s purposes, and subject to the applicable Order Form or other ordering document.</span></p><p>
            <span>Affiliates</span><span>. In addition to any access rights a Customer Affiliate may have as an End U
            ser of Customer, a Customer Affiliate may separately acquire Subscriptions under this Agreement by entering into an Order Form 
            that incorporates by reference the terms of this Agreement, and in each such case, all references in this Agreement to the Customer 
            will be deemed to refer to the applicable Affiliate for purposes of that Order Form.</span></p>
            <p><span>Acceptable Use Terms</span><span>. The Service may not be used for unlawful, harmful, obscene, 
            offensive, or fraudulent Customer Data or activity. Examples of prohibited activities are advocating or causing harm, interfering with or 
            violating the integrity or security of a network or system, evading filters, sending unsolicited, abusive, or deceptive messages, introducing 
            viruses or harmful code, or violating third party rights. Customer will not (a) make the Service available to anyone other than Customer and
            its End Users or use the Service for the benefit of anyone other than Customer or its Affiliates; (b) rent, sublicense, re-sell, assign, 
            distribute, time share or similarly exploit the Service (including allowing its employees or employees of its Affiliates to accessthe Service 
            as guests instead of acquiring End User Subscriptions for such employees); (c) reverse engineer, copy, modify, adapt, or hack the Service; 
            (d) access the Service, the Documentation, or Company&rsquo;s Confidential Information to build a competitive product or service; or (e) 
            allow End User Subscriptions to be shared or used by more than one individual End User (except that End User Subscriptions may be reassigned
            to new End Users replacing individuals who no longer use the Service for any purpose). Company may request that Customer suspend the account 
            of any End User who: (i) violates this Agreement or Company&rsquo;s User Terms of Service; or (ii) is using the Service in a manner that
            Company reasonably believes may cause a security risk, a disruption to others&rsquo; use of the Service, or liability for Company. If 
            Customer fails to promptly suspend or terminate such End User&rsquo;s account, Company reserves the right to do so.</span></p>
            <p><span>Security; Protection of Customer Data</span><span>. Company will implement and maintain 
            reasonable administrative, organizational, and technical safeguards designed for the protection, confidentiality, and integrity of 
            Customer Data.</span></p><p><span>Administration of Customer&rsquo;s Account</span><span>. Customer 
            acknowledges that it retains administrative control over to whom it grants access to Customer Data hosted in the Service. Customer may 
            specify one or more End Users as administrators (each an &ldquo;Administrator&rdquo;) to manage its account, and Company is entitled to 
            rely on communications from such Administrators and other Customer employees when servicing Customer&rsquo;s account. Customer is responsible 
            for use of the Service by its End Users and for their compliance with this Agreement. Customer is solely responsible for the accuracy, 
            quality, and legality of Customer Data. Customer will promptly notify Company if it becomes aware of any unauthorized use or access to 
            Customer&rsquo;s account or the Service.</span></p><p><span>Customer&rsquo;s Use of Third Party Services</span>
            <span>. Customer may install or enable third party services for use with the Service, such as online applications, offline 
            software products, or services that utilize the Company API or otherwise connect with the Service (&ldquo;Third Party Services&rdquo;). 
            Any acquisition and use by Customer or its End Users of such Third Party Services is solely the responsibility of Customer and the 
            applicable third party provider. Customer acknowledges that providers of such Third Party Services may have access to Customer Data in 
            connection with the interoperation and support of such Third Party Services with the Service. To the extent Customer authorizes the 
            access or transmission of Customer Data through a Third Party Service, such Third Party Service terms will govern, and Company will not 
            be responsible for, any use, disclosure, modification or deletion of such Customer Data or for any act or omission on the part of such 
            third party provider or its service.</span></p><p><span>Representations and Warranties</span>
            <span>. </span></p><p><span>Mutual Warranties</span><span>. Each party represents 
            and warrants that it will comply with all laws, rules, and regulations applicable to the exercise of its rights and performance of its 
            obligations under this Agreement.</span></p><p><span>By Company</span><span>.</span></p><p>
            <span>Service Warranties</span><span>. Company warrants during the applicable Subscription Term that: (a) the 
            Service will materially conform to the applicable Documentation; and (b) Company will not materially decrease the functionality of the
            Service. For any breach of the foregoing warranties, as Company&rsquo;s sole liability and Customer&rsquo;s exclusive remedy, Company 
            will correct the non-conforming Service, and, if Company is unable to correct the Service within a commercially reasonable time following 
            receipt of written notice of breach, then Customer will be entitled to terminate the applicable Order Form and receive a refund of any 
            prepaid, unused fees applicable to the remaining portion of the Subscription Term measured from the effective date of termination.</span>
            </p><p><span>By Customer</span><span>. Customer represents and warrants that it is entitled to transfer 
            the Customer Data to Company so that Company and its authorized third party service providers may lawfully use, process, and transfer the 
            Customer Data in accordance with this Agreement on Customer&rsquo;s behalf.</span></p><p><span>DISCLAIMER</span>
            <span>. EXCEPT AS EXPRESSLY PROVIDED FOR IN THIS AGREEMENT, COMPANY DOES NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION 
            OF THE SERVICE OR THAT COMPANY WILL CORRECT ALL DEFECTS OR PREVENT THIRD-PARTY DISRUPTIONS OR UNAUTHORIZED THIRD-PARTY ACCESS. THESE 
            WARRANTIES ARE THE EXCLUSIVE WARRANTIES FROM COMPANY AND REPLACE ALL OTHER WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OR CONDITIONS 
            OF SATISFACTORY QUALITY, MERCHANTABILITY, NON-INFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE. COMPANY WARRANTIES WILL NOT APPLY IF 
            THERE HAS BEEN MISUSE, MODIFICATION, DAMAGE NOT CAUSED BY COMPANY, OR FAILURE TO COMPLY WITH INSTRUCTIONS PROVIDED BY COMPANY. EACH PARTY 
            DISCLAIMS ALL LIABILTY FOR ANY HARM OR DAMAGES CAUSED BY ANY THIRD-PARTY HOSTING PROVIDERS. COMPANY MAKES BETA, TRIAL, PROOF OF CONCEPT 
            AND &ldquo;SANDBOX&rdquo; VERSIONS OF THE SERVICE AVAILABLE AS-IS WITHOUT WARRANTIES OF ANY KIND. </span></p><p>
            <span>Payment</span><span>. </span><span>Customer will pay all undisputed amounts due under the 
            applicable Order Form within thirty (30) days of invoice date. If Customer disputes any part of an invoice in good faith, Customer 
            will pay the undisputed part and provide Company with notice and detail of the dispute no later than the invoice due date. Amounts 
            due are payable in the currency set forth in the applicable invoice and are non-cancelable and non-refundable unless otherwise 
            provided in this Agreement. For customers located outside of the United States, Company may require that payment be made to the bank 
            account of a local Company Affiliate. Customer is responsible for providing complete and accurate billing information to Company, 
            including the purchase order number at the time of purchase if Customer requires one. Company reserves the right to suspend Customer&rsquo;s 
            account in the event that Customer&rsquo;s account becomes overdue and is not brought current within ten (10) business days following notice.
            Unpaid amounts may be subject to interest at the lesser of 1.5% per month or the maximum permitted by law plus collection costs. 
            Suspension will not relieve Customer&rsquo;s obligation to pay amounts due. For transactions where Customer is permitted to make 
            payment via credit card, Customer agrees that, if eligible, Company may update Customer&#39;s payment information through the use 
            of account refresher services provided by third party payment processors.</span></p><p><span>End User 
            Subscriptions</span><span>. Subscription fees are based on annual or monthly periods (or pro rata portions of such periods, c
            alculated on a daily basis) that begin on the Subscription start date and each annual or monthly anniversary of the start date. 
            Subscriptions to the Service are sold in tiers based on the number of End Users. Customer may add End Users to their Subscription 
            at any time on written notice to Company (email notice acceptable), however the number of End Users acquired under a Subscription 
            cannot be decreased during the applicable Subscription Term. Company reserves the right to calculate the total number of End Users 
            on a periodic basis, and, if such number exceeds Customer&rsquo;s current plan size, Company reserves the right to invoice Customer 
            for the tier that corresponds to the number of End Users on a pro rata basis for the remaining months in Customer&rsquo;s 
            then-current annual Subscription Term, so that all End User Subscription Terms are coterminous. Company reserves the right to 
            revise fee rates and/or the billable amount structure for the Service at any time and will provide Customer with notice as stated 
            in this Agreement of any such changes at least twenty (20) days prior. Company may charge Customer the then-current pricing for 
            the applicable Subscription if the number of End Users is modified and/or if Customer changes its Subscription plan.</span></p>
            <p><span>Taxes</span><span>. Any fees charged to Customer are exclusive of taxes. Except for 
            those taxes based on Company&rsquo;s net income, Customer will be responsible for all applicable taxes in connection with this 
            Agreement including, but not limited to, sales, use, excise, value added, goods and services, consumption, and other similar taxes 
            or duties. If any withholding is required by law, Customer will pay Company any additional amounts necessary to ensure that the net 
            amount that Company receives, after any such withholding, equals the amount Company would have received if no withholding had been 
            applied. Upon request, Customer will provide documentation showing that the withheld amounts have been paid to the relevant taxing 
            authority. Company&rsquo;s failure to charge appropriate tax due to incomplete or incorrect information provided by Customer will 
            not relieve Customer of its obligations. If Customer is exempt from certain taxes, Customer will provide proof of such exemption to 
            Company without undue delay upon execution of the applicable Order Form.</span></p><p><span>Auto-renewal</span>
            <span>. Customer agrees that its Subscription will automatically renew on an annual or monthly basis depending on 
            Customer&rsquo;s Subscription (the &ldquo;Renewal Date&rdquo;). Customer authorizes Company to automatically charge Customer 
            for the applicable fees on or after the Renewal Date unless the Subscription has been terminated or cancelled in accordance with this 
            Agreement. If Customer wishes to reduce the number of End Users in its Subscription, it must do so prior to the Renewal Date. Customer 
            must cancel its Subscription prior to the Renewal Date in order to avoid billing of the next period&rsquo;s Subscription fees. Customer 
            can cancel its Subscription anytime online by going into its account settings and following the instructions provided. If Customer 
            chooses to cancel its Subscription during the Subscription Term, Customer may use the Service until the end of Customer&rsquo;s 
            then-current Subscription Term or renewal period, but will not be issued a refund for the most recently (or any previously) charged 
            fees.</span></p><p><span>Term and Termination</span><span>.</span></p>
            <p><span>Term</span><span>. This Agreement commences on the Effective Date and will remain in effect 
            until all Subscriptions to the Service granted in accordance with this Agreement have expired or been terminated, or this Agreement is 
            otherwise terminated in accordance with its terms.</span></p><p><span>Termination for Cause</span><span>. 
            Company may terminate this Agreement immediately if Company determines in Company&rsquo;s sole discretion that Customer has used the 
            Service for illegal or illicit purposes. Either party may terminate this Agreement and any Order Form under this Agreement: (a) upon 
            thirty (30) days written notice if the other party is in material breach of this Agreement and fails to cure such breach within 
            the notice period, except that termination will take effect upon receipt of notice in the event of a breach of this Agreement; 
            or (b) if the other party ceases its business operations or becomes subject to insolvency proceedings and the proceedings are 
            not dismissed within sixty (60) days.</span></p><p><span>Effect of Termination</span><span>. 
            Upon expiration or termination of this Agreement for any reason, all Subscriptions and any other rights granted to Customer under 
            this Agreement will immediately terminate, and Customer will immediately cease all use of the Service. Upon any termination by 
            either party for cause, Company will refund to Customer a prorated amount of prepaid, unused fees applicable to the remaining 
            portion of the Subscription Term measured from the effective date of termination. In no event will any termination relieve Customer 
            of the obligation to pay any fees accrued or payable to Company for the Service in the period prior to the effective date of 
            termination. Any terms that by their nature extend beyond the Agreement termination remain in effect until fulfilled and apply 
            to successors and assignees.</span></p><p><span>Treatment of Customer Data Following Expiration or 
            Termination</span><span>. Customer agrees that following expiration or termination of this Agreement, Company may 
            immediately deactivate Customer&rsquo;s account(s) associated with the Agreement. Company will make Customer Data available to 
            Customer for export in accordance with the Documentation as long as Company receives written notice within thirty (30) days 
            after the effective date of expiration or termination from Customer regarding its intent to import such Customer Data. After 
            such thirty (30) day period, Company will have no obligation to retain Customer Data and will thereafter, unless legally 
            prohibited, be entitled to delete all Customer Data in its systems or otherwise in its possession or under its control. 
            Subject to any limitations in Customer&rsquo;s Subscription plan, upon Customer&rsquo;s request at datadeletions@fosforescent.com, 
            Company will, within one-hundred and eighty (180) days of receipt of such request, securely destroy all Customer Data from its 
            systems; provided that all back-ups will be deleted within thirty (30) days after such one-hundred and eighty (180) day period.</span>
            </p>
            <p><span>Confidentiality</span><span>.</span></p><p>
            <span>Definition of Confidential Information</span>
            <span>. During the course of performance under this Agreement, each 
            party may make available to the other party information that is identified as, or should reasonably be understood by the 
            receiving party to be, proprietary or confidential (the &ldquo;Confidential Information&rdquo;). Confidential Information 
            specifically includes this Agreement, the Service, Order Form(s), Customer Data, business plans, product plans and roadmaps,
            strategies, forecasts, projects and analyses, financial information and fee structures, business processes, methods and models, 
            and technical documentation. Confidential Information does not include information that is: (a) publicly available when received, 
            or subsequently becomes publicly available through no fault of the receiving party; (b) obtained by receiving party from a source 
            other than the disclosing party without obligation of confidentiality; (c) developed independently by the receiving party; or (d) 
            already in the possession of the receiving party without obligation of confidentiality.</span></p><p>
            <span>Protection of Confidential Information</span><span>. The receiving party will use the same care 
            and discretion to avoid disclosure, publication, or dissemination of the disclosing party&rsquo;s Confidential Information 
            as it uses with its own similar information that it does not wish to disclose, publish or disseminate, but in no event less 
            than a reasonable degree of care. The receiving party may disclose Confidential Information to its employees, Affiliates, 
            consultants, subcontractors, or advisors (&ldquo;Representatives&rdquo;) who have a need to know such Confidential Information 
            for the purpose of performing under this Agreement and only to those who are obligated to maintain the confidentiality of such 
            Confidential Information upon terms at least as protective as those contained in this Agreement. If the parties entered into a 
            non-disclosure agreement prior to executing this Agreement, the terms of Confidentiality will control in the event of any 
            conflict or inconsistency.</span></p><p><span>Equitable Relief</span><span>. In the event of a 
            breach of Confidentiality, the disclosing party may seek appropriate equitable relief in addition to any other remedy.</span>
            </p>
            <p><span>Compelled Disclosure</span><span>. The receiving party may disclose Confidential 
            Information to the extent required by law or court order. However, subject to applicable law, the receiving party will give the 
            disclosing party prompt notice to allow the disclosing party a reasonable opportunity to obtain a protective order.</span></p>
            <p><span>Sensitive Personal Information</span><span>. Customer agrees that it will not use the 
            Service to send or store personal information deemed &ldquo;sensitive&rdquo; or &ldquo;special&rdquo; under applicable law, 
            including but not limited to financial account information, social security numbers, government-issued identification numbers, 
            health information, biometric or genetic information, personal information collected from children under the age of 16, 
            geolocation information of individuals, or information about an individual&rsquo;s racial or ethnic origin, trade union 
            membership, sex life or sexual orientation, political opinions, or religious or philosophical beliefs (collectively, &ldquo;
            Sensitive Personal Information&rdquo;).</span></p><p><span>Intellectual Property Rights</span>
            <span>. Use of the Service will not affect Customer&rsquo;s ownership or license rights in Customer Data. Company 
            and its authorized third party service providers may use, host, store, backup, transmit, and display Customer Data to (a) provide
            the Service under this Agreement and (b) improve the Service as long as neither Customer nor its End Users are publicly identified
            . Neither this Agreement nor Customer&rsquo;s use of the Service grants Customer or its End Users ownership in the Service, 
            including any enhancements, modifications or derivatives of the Service.</span></p>
            <p><span>Feedback</span><span>. If Customer submits any feedback to Company regarding 
            the Service, Company may use such feedback for any purpose without any compensation or obligation to Customer provided 
            such use does not violate the confidentiality provisions of this Agreement.</span></p><p>
            <span>Indemnification</span><span>. </span><span>Company has no responsibility for 
            claims based on non-Company products and services, items not provided by Company, or any violation of law or third party 
            rights caused by Customer Data or other Customer materials. If a third party asserts a claim against Company that Customer
            Data infringes a patent or copyright or violates a privacy right, Customer will (a) defend Company against that claim and (b) 
            pay amounts finally awarded by a court against Company or included in a settlement approved by Customer. To obtain such 
            defense and payment by Customer, Company must promptly (i) notify Customer in writing of the claim, (ii) supply information 
            requested by Customer, and (iii) allow Customer to reasonably cooperate in, the defense and settlement, including mitigation 
            efforts. This Section states each party&rsquo;s entire obligation and exclusive remedy regarding the third party claims 
            described in the Section.</span></p><p><span>Liability</span><span>. </span>
            <span>A party&rsquo;s entire liability in the aggregate for all claims related to the Agreement (regardless of
            the basis of the claim) will not exceed any actual direct damages incurred by the other party up to the total amount paid 
            by Customer under this Agreement in the twelve (12) months preceding the first event giving rise to liability. Neither 
            party will be liable for (a) special, incidental, exemplary, or indirect damages, or any economic consequential damages, 
            or (b) lost profits, business, value, revenue, goodwill, or anticipated savings. The liability limitations in this section 
            do not apply to (i) a party&rsquo;s indemnification payments set forth herein (Indemnification), and (ii) damages that cannot 
            be limited under applicable law.</span></p><p><span>Export Control and Economic Sanctions; 
            Compliance</span><span>. </span><span>&nbsp;Each party represents that it is not named on any U.S. 
            government list of prohibited or restricted parties, nor is it owned or controlled by or acting on behalf of any such 
            parties. Customer agrees that it will not access or use the Service in any manner that would cause any party to violate any 
            U.S. or international embargoes, economic sanctions, or export controls laws or regulations.</span></p>
            <p><span>Miscellaneous</span><span>.</span></p>
            <p><span>Governing Law; Venue</span><span>. Both parties agree to (i) the application of 
            the laws of the Commonwealth of Kentucky, United States, without regard to conflict of law principles and (ii) the exclusive 
            jurisdiction and venue in the state or Federal courts located in Jefferson County, Kentucky. The United Nations Convention on
            Contracts for the International Sale of Goods does not apply to transactions under the Agreement.</span></p>
            <p><span>Notices</span><span>. Company may give general notices related to the Service
            that apply to all customers by email, in-app notifications, or posting them through the Service. Other notices under
            the Agreement must be in writing and sent to the business mailing or email address specified in this Section or the
            Order Form, unless a party designates in writing a different address. Notices are deemed given when received. Notices 
            to Company must be sent by email to legal@fosforescent.com.</span></p>
            <p><span>Publicity</span><span>. Company may include Customer&rsquo;s name 
            and logo in Company&rsquo;s online customer list and in print and electronic marketing materials.</span></p>
            <p><span>Channel Partners</span><span>. Customer may 
            acquire Subscriptions through Company channel partners. Such channel partners are 
            independent from Company and unilaterally determine their prices and terms. Company is not responsible for their 
            actions, omissions, statements or offerings.</span></p>
            <p><span>Consents</span><span>. Where approval, acceptance, consent, access, 
            cooperation, or similar action by either party is required, such action will not be unreasonably withheld.</span></p>
            <p><span>Access to Non-Production Versions of the Service</span><span>. Customer
            may be provided with access to beta, trial, proof of concept, or sandbox versions of the Service or features 
            within the Service (collectively, the &ldquo;Non-Production Versions of the Service&rdquo;). Customer acknowledges 
            and understands that its use of the Non-Production Versions of the Service is not required and is at Customer&rsquo;s
            own risk, and that Non-Production Versions of the Service are made available on an &ldquo;as is&rdquo; basis 
            without warranties of any kind, may be discontinued or modified at any time, and may be subject to other terms. 
            Non-Production Versions of the Service are not for production use, not supported, and not subject to availability
            or security obligations. Company will have no liability for any harm or damage arising out of or in connection
            with Non-Production Versions of the Service. Customer acknowledges that its trial will automatically convert
            to a Subscription at the end of the trial and that Company may charge Customer for the applicable Subscription
            fees unless Customer has notified Company in writing of its decision to opt out during the trial.</span></p>
            <p><span>Relationship of the Parties</span><span>. Company is an 
            independent contractor, not Customer&rsquo;s agent, joint venturer, partner, or fiduciary. No right or 
            cause of action for any third party is created by the Agreement or any transaction under it.</span></p>
            <p><span>Force Majeure</span><span>. Neither party is responsible for 
            failure to fulfill its non-monetary obligations due to causes beyond its control.</span></p>
            <p><span>Severability; No Waiver</span><span>. If any provision of 
            the Agreement is invalid or unenforceable, the invalid or unenforceable provision shall be reformed to 
            be valid and enforceable to the maximum extent within the intention of the provision, and in any case the 
            remaining provisions will remain in full force and effect.</span></p>
            <p><span>
            Assignment. Either party may assign the Agreement to its Affiliate or to its successor in interest in 
            connection with a merger, acquisition, corporate reorganization, or sale of all or substantially all of 
            its assets.</span></p><p><span>Modifications</span><span>. Company may 
            revise this Agreement from time to time by posting the modified version on its website. If, in 
            Company&rsquo;s sole discretion, the modifications proposed are material, Company will provide Customer 
            with notice in accordance the notice section of this Agreement with at least thirty (30) days prior 
            to the effective date of the modifications being made. By continuing to access or use the Service after 
            the posted effective date of modifications to this Agreement, Customer agrees to be bound by the revised 
            version of the Agreement.</span></p>
            <p><span>Dispute Resolution</span><span>. All disputes 
            arising out of this Agreement shall be brought in the state and Federal courts located in Jefferson County, 
            Kentucky, to which Customer submits to personal jurisdiction.</span></p>
          </DialogDescription>

        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <a className={`${buttonVariants({ variant: 'secondary' })}`} href={documents.agreement} target="_blank" rel="noreferrer">Print</a>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleReject} className="" variant="destructive">Reject</Button>
          <Button onClick={handleAccept} className="bg-emerald-900">Accept</Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}