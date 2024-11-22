import { Button } from "@/frontend/components/ui/button"
import { buttonVariants } from "@/frontend/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/frontend/components/ui/dialog"
import { Input } from "@/frontend/components/ui/input"
import { Label } from "@/frontend/components/ui/label"

import { Switch } from "@/frontend/components/ui/switch"
import { useEffect, useState } from "react"

import { documents } from "../../assets" 
import { AppState, FosReactOptions } from "@/shared/types"

export function PrivacyPolicyDialog({
  open,
  setOpen,
  data,
  setData,
  options
} : {
  open: {open: boolean, fromRegisterForm: boolean}
  setOpen: (open: boolean) => void
  data: AppState,
  setData: (state: AppState) => void
  options: FosReactOptions
}) {



  return (
    <Dialog open={open.open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="max-h-96 overflow-y-hidden">
          <DialogTitle aria-description='Privacy Policy'>Privacy Policy</DialogTitle>
          <DialogDescription className="overflow-y-scroll">

          <p>Sycamore
Technology LLC (“Company”) offers a variety of team productivity,
collaboration, and organizational tools available online, including via a
mobile application (collectively, the “Service”), and websites, including but
not limited to www.fosforescent.com (the “Websites”). As you use the
Service and interact with the Websites, Company collects and processes
information from and about you in order to provide you with access to the
Service, enhance your experience while using the Service, and interact with
you. This Privacy Policy (the “Policy”) describes how Company collects, uses,
and discloses information collected through the Service and Websites, and what
choices you have with respect to such information. The first section below
explains which privacy terms are applicable to you depending on what type of
user you are.</p>

<p>References
to “Company” throughout the Policy mean the Company entity that acts as the
data controller or data processor of your information, as explained in more
detail below. If you do not agree with this Policy, do not access or use the
Service, Websites, or any other part of Company&apos;s business.</p>

<p>If
you have any questions about this Privacy Policy, please contact Company at: Privacy@fosforescent.com.</p>

<p>This
Privacy Policy contains the following sections:</p>

<p>I.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
What Type of User am I and What Privacy Terms are Applicable
to Me?</p>

<p>II.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Privacy Terms for Subscribers</p>

<p>III.Privacy
Terms for Free Users</p>

<p>IV.&nbsp;&nbsp;&nbsp;
Privacy Terms for Site Visitors</p>

<p>V.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Additional Privacy Terms for All Users</p>

<p>VI.&nbsp;&nbsp;&nbsp;
Company Contact Info</p>

<p>I.
What Type of User am I and What Privacy Terms are Applicable to Me?</p>

<p>Company
has three different types of users depending on the Company products used.
Please see the bullets below to determine which type of user you are, and then
click the internal link to visit the privacy terms applicable to you. It is
possible that you may use Company in different ways. If so, please review all
applicable privacy terms. Also, don&apos;t forget to review Section V, which
contains privacy terms applicable to all users.</p>

<p>Subscribers.
We call users who use the Service as part of any tier of a paid Company
subscription plan “Subscribers.” The Service features and functionalities
available to Subscribers are determined by the specific terms agreed to between
Company and the organization (e.g., your employer or another entity or person,
called the “Customer”) that entered into a separate agreement that governs
delivery, access, and use of the Service (for purpose of this Policy, the
“Customer Agreement”). The Customer controls its instance of the Service and is
the data controller of the information collected through the Service about
Subscribers, and Company is a data processor of such information. To go
directly to the terms applicable to Subscribers, please click here.</p>

<p>Free
Users. We call users who use a non-paid version of the Service “Free Users.”
While Free Users can access and use the Service, they have access to a more
limited set of Service features and functionality than Subscribers. Company is
the data controller</p>

<p>of
the information collected through the Service about Free Users. To go directly
to the terms applicable to Free Users, please click here.</p>

<p>Site
Visitors. We call users of the Websites “Site Visitors.” Site Visitors can be
individuals who are simply browsing the Websites but who do not use the Company
Service; or, Site Visitors can be Free Users or Subscribers who visit the
Websites to seek additional information about Company. Company is the data
controller of the information collected through the Website about Site
Visitors. To go directly to the terms applicable to Site Visitors please click
here.</p>

<h2>II. Privacy Terms for
Subscribers</h2>

<p>A.&nbsp;&nbsp;&nbsp;
Overview</p>

<p>Section
II of this Policy applies only to Subscribers. If you are a Subscriber, the </p>

<p>&ldquo;Customer
Agreement&rdquo; governs the collection and processing of information collected from
you through the Customer&apos;s instance of the Service (e.g. a Customer&apos;s
organization or workspace, but for purposes of this Policy referred to as the </p>

<p>&ldquo;Workspace&rdquo;),
including all associated messages, attachments, files, tasks, projects and
project names, team names, channels, conversations, and other content submitted
through the Service (“Workspace Content”). In the event of a conflict between
this Privacy Policy and the Customer Agreement, the Customer Agreement governs.
Because the Customer controls the Workspace used by Subscribers, if you have
any questions about the Customer&apos;s specific Workspace settings and privacy
practices, please contact the Customer whose Workspace you use. If you are a
Subscriber located in the European Union, please note that the Customer is the
data controller with respect to the processing of your Workspace Content
pursuant to the EU General Data Protection Regulation (“GDPR”). When processing
Workspace Content of EU data subjects governed by the Customer Agreement, Company
is the data processor, meaning that we collect and process such information
solely on behalf of the Customer.</p>

<p>B.&nbsp;&nbsp;&nbsp;
Collection and Use of Subscriber Information</p>

<p>This
section explains the information we collect from Subscribers. We do not require
Subscribers to provide us with information. However, certain information, such
as account log-in data, is required to provide you with access to the Service,
and other information may be collected automatically as you use the Service.</p>

<p>1.&nbsp;&nbsp;&nbsp;
Workspace Content. Workspace Content is collected, used, and
shared by Company in accordance with the Customer&apos;s instructions, including any
applicable terms in the Customer Agreement, or as required by applicable law.
The Customer, and not Company, determines its own, internal policies regarding
storage, access, modification, deletion, sharing, and retention of Workspace
Content which may apply to your use of the Service. For example, a Customer may
provide or remove access to the Service, enable or disable third party
integrations, manage permissions, retention and export settings, transfer or
assign teams, or share projects. Please check with the Customer about the
policies and settings that they have instituted with respect the Workspace
Content that you provide when using the Service.</p>

<p>2.&nbsp;&nbsp;&nbsp;
Account Information. To set up your Company account, you or
the Customer will provide us with basic information about you which may include
your name, address, telephone number, email address, and password. You will
then have the ability to provide optional profile information, such as a
photograph or basic demographic data. With your permission, we may also upload
calendar information stored on your mobile device to your account. If you
submit payment information in connection with your use of the Service, we
utilize a third party credit card payment processing company to collect payment
information, including your credit card number, billing address, and phone
number. In such circumstances, the third party service provider, and not Company,
stores your payment information on our behalf.</p>

<p>3.&nbsp;&nbsp;&nbsp;
Service Usage Information. As you use the Service, we collect
information about how you use and interact with the Service (“Service Usage
Information”). Such information includes:</p>

<p>Device
information – when you access the Service using a mobile device, we collect
certain device information, including the type of device you are using, its
operating system, and mobile network information, which may include your mobile
phone number. We may also collect your MAC address and other unique device
identifiers.</p>

<p>Log
files – when you use the Service, our servers automatically record information
in server log files. These log files may include information such as your web
request, IP address, browser type and settings, referring/exit pages and URLs,
number of clicks, date and time stamp information, language preferences, data
from cookies and similar technologies, and other such information.</p>

<p>Location
information – we may collect and process general information about the location
of the device from which you are accessing the Service (e.g., approximate
geographic location inferred from an IP address).</p>

<p>Workspace
Use Metadata – when you interact with the Service, metadata is generated that
provides high-level (non-content) information about the way you work in your
Workspace. For example, we may log the number of Workspaces you work in; the
number of tasks to which you are assigned; the features and embedded Service
content you interact with; the types of files you share; and what, if any,
third party services and integrations you use.</p>

<p>4.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Other Information. You may provide us with information when
you interact with us in other ways, such as when you submit requests or
questions to us via forms or email (e.g., support forms, sales forms, user
research participation forms); or research studies in which you choose to
participate; beta testing; and requests for customer support and technical
assistance (collectively, “Other Information”).</p>

<p>5.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Information Collected from Third-Party Integrations. If you
choose to use or connect to third-party integrations through the Service, or if
you are required or permitted to do so by a Customer, such third parties may
allow us to have access to and store additional information about your
interaction with those services as it relates to your use of the Service. If
you initiate these connections, you also understand that we will share
information about you that is required to enable your use of the third-party
integration through the Service. If you do not wish to have this information
shared, do not initiate these connections. By enabling these connections, you
authorize us to connect and access the information provided through these
connections, and you understand that the privacy policies of these third
parties govern such connections.</p>

<p>C.
How Does Company Use Subscriber Information?</p>

<p>This
section explains how Company uses information collected from Subscribers.</p>

<p>1.
Workspace Content. Company may view and use Workspace Content
collected from and about Subscribers only as necessary:</p>

<p>To maintain, provide and improve the Service</p>

<p>To
prevent or address technical or security issues and resolve support requests</p>

<p>To
investigate when we have a good faith belief, or have received a complaint
alleging, that such Workspace Content is in violation of the Customer Agreement
or our User Terms of Service</p>

<p>To
comply with a valid legal subpoena, request, or other lawful process that meets
the requirements of the Customer Agreement and our Law Enforcement Guidelines</p>

<p>As
otherwise set forth in our Customer Agreement or as expressly permitted in
writing by the Customer</p>

<p>2.
Account Information, Service Usage Information, Information
from Third Party Integrations, and Other Information. Company may use these
categories of information collected from and about Subscribers to:</p>

<p>Maintain, provide, and improve the Service</p>

<p>Respond
to your requests for information</p>

<p>Prevent
or address technical or security issues and resolve support requests</p>

<p>Investigate
in good faith alleged violations of our <a
href="https://asana.com/id/terms/terms-of-service">User
Terms of Service</a></p>

<p>Comply
with a valid legal subpoena, request, or other lawful process that meets the
requirements of our <a
href="https://asana.com/id/terms/law-enforcement-guidelines">Law Enforcement Guidelines</a></p>

<p>Help
us better understand user interests and needs, and customize the Service for
our users</p>

<p>Engage in analysis, research, and reports regarding use of
the Service</p>

<p>Protect
the Service and our users</p>

<p>Communicate
with you via email and through the Service about important notices and updates
regarding the Service, such as to inform you about changes in the</p>

<p>Service,
our service offerings, and important services-related notices, such as about
security and fraud. Because these communications are an important part of the
Service, you may not opt out of them</p>

<p>In
accordance with applicable legal obligations, communicate with you about
promotions, offers, and news about Company. You have the ability to unsubscribe
from such promotional communications</p>

<p>Provide
cross-device management of your account. For example, we may locate or try to
locate the same unique users across multiple browsers or devices (such as
smartphones or tablets), or work with service providers that do this, in order
to save your preferences across devices and analyze usage of the Service. If
you wish to opt out of the ability of one our service providers, Google
Analytics, to locate you across devices in this way, you may install the Google
Analytics Opt-out Browser Add-on by <a
href="https://tools.google.com/dlpage/gaoptout">clicking
here</a></p>

<p>D.
Sharing of Subscriber Information</p>

<p>In
accordance with the applicable Customer Agreement, we may share the information
we collect from Subscribers as follows:</p>

<p>Affiliates
and Subsidiaries. We may share the information we collect within the Company
family of companies.</p>

<p>Service
Providers. We may provide access to or share your information with select third
parties that use the information only to perform services on our behalf. These
third parties provide a variety of services to us, including without limitation
sales, marketing, provision of content and features, analytics, data storage,
security, fraud prevention, and other services.</p>

<p>Business
Transactions. If the ownership of all or substantially all of our business
changes, we may transfer your information to the new owner so that the Service
can continue to operate. In such case, your information would remain subject to
the promises and commitments contained in this Policy until such time as the
acquiring party modifies it. If such transfer is subject to additional
mandatory restrictions under applicable laws, Company will comply with such
restrictions.</p>

<p>Consistent
with your settings within the Service. Please note that the Workspace</p>

<p>Content
you submit through the Service may be viewable by other users in your Workspace
and within your organization, depending on the specific settings you and your
organization have selected.</p>

<p>E.&nbsp;&nbsp;&nbsp;&nbsp;
Aggregate De-Identified Data</p>

<p>We
may aggregate and/or de-identify information collected through the Service so
that such information can no longer be linked to you or your device
(“Aggregate/DeIdentified Information”). We may use Aggregate/De-Identified
Information for any purpose, including without limitation for research and
analytics, and may also share such data with any third parties, including
partners, affiliates, services providers, and others.</p>

<p>F.&nbsp;&nbsp;&nbsp;&nbsp;
Combined Information</p>

<p>We
may combine the information that we collect through the Service with
information that we receive from other sources, both online and offline, and
use such combined information in accordance with this Policy and the Customer
Agreement.</p>

<p>G.&nbsp;&nbsp;&nbsp;
Data Retention</p>

<p>We
will retain your information for the period necessary to fulfill the purposes
outlined in this Policy unless a longer retention period is required or
permitted by law, or where the Customer Agreement requires or permits specific
retention or deletion periods.</p>

<p>H.&nbsp;&nbsp;&nbsp;
Data Subject Rights</p>

<p>Please
contact your Workspace owner(s) or administrator(s) to exercise any data
subject rights you have under applicable local laws, including your ability to
access, delete, rectify, transfer, or object under the GDPR.</p>

<h2>III. Privacy Terms for
Free Users</h2>

<p>A.&nbsp;&nbsp;&nbsp;
Overview</p>

<p>Section
III of this Policy applies only to Free Users of the Service. If you are a Free
User located in the European Union, Company is the data controller with respect
to the processing of your personal data pursuant to the GDPR.</p>

<p>B.&nbsp;&nbsp;&nbsp;
Collection and Use of Free User Information</p>

<p>This
section explains how we collect, process, and use the information collected
from Free Users. We do not require Free Users to provide us with information.
However, certain information, such as account log-in data, is required to
provide you with access to the Service, and other information may be collected
automatically as discussed below.</p>

<p>1.
Information You Provide to Company. Company collects the
following information submitted directly through the Service by Free Users:</p>

<p>The
messages, attachments, files, tasks, project names, team names, channels,
conversations, and other content submitted through the Service (collectively,
the “Workspace Content”);</p>

<p>Information
you provide as part of your account registration with Company, which may
include your name, organization name, address, telephone number, email address,
username and password; optional information that you may choose to provide,
such as a photograph or basic demographic data; and, with your permission,
calendar information stored on your mobile device that you may elect to upload
to your account (collectively, the &quot;Account Information”); and</p>

<p>Information
you provide in other interactions with us, such as requests or questions you
submit to us via forms or email (e.g., support forms, sales forms, user
research participation forms), information you provide in connection with Company
sweepstakes, contests, or research studies in which you choose to participate;
beta testing; and requests for customer support and technical assistance
(collectively, “Other Information”).</p>

<p>2.
Service Usage Information. As you use the Service, we collect
a variety of information about how you use and interact with the Service
(“Service Usage Information”). Such information includes:</p>

<p>Device
information – when you access the Service using a mobile device, we collect
certain device information, including the type of device you are using, its
operating system, and mobile network information, which may include your mobile
phone number. We may also collect your MAC address and other unique device
identifiers.</p>

<p>Log
files – when you use the Service, our servers automatically record certain
information in server log files. These log files may include information such
as your web request, IP address, browser type and settings, referring / exit
pages and URLs, number of clicks, date and time stamp information, language
preferences, data from cookies and similar technologies, and other such
information.</p>

<p>Location
information – we may collect and process general information about the location
of the device from which you are accessing the Service (e.g., approximate
geographic location inferred from an IP address).</p>

<p>Workspace
Use Metadata – when you interact with the Service, metadata is generated that
provides high-level (non-content) information about the way you work in your
Workspace. For example, we may log the number of Workspaces you work in; the
number of tasks to which you are assigned; the features and embedded Service
content you interact with; the types of files you share; and what, if any,
third party services and integrations you use.</p>

<p>3.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Information Collected from Third Party Integrations. If you
choose to use or connect to third-party integrations through the Service, such
third parties may allow us to have access to and store additional information
about your interaction with those services as it relates to your use of the
Service. Moreover, if you initiate these connections, you also understand that
we will share information about you that is required to enable your use of the
third-party integration through the Service. If you do not wish to have this
information shared, do not initiate these connections. By enabling these
connections, you authorize us to connect and access the information provided
through these connections, and you understand that the privacy policies of
these third parties govern such connections.</p>

<p>4.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Information Collected from Other Third Parties. Company may
receive additional information about you, such as demographic information, from
affiliates under common ownership and control, and from third parties, such as
business partners, marketers, researchers, analysts, and other parties that we
may use to supplement the information that we collect directly from you.</p>

<p>C.
Use of Free User Information</p>

<p>Company
may use the information collected from Free Users to:</p>

<p>Maintain, provide, and improve the Service</p>

<p>Respond
to your requests for information</p>

<p>Prevent
or address technical or security issues and resolve support requests</p>

<p>Investigate
in good faith alleged violations of our <a
href="https://asana.com/id/terms/terms-of-service">User
Terms of Service</a></p>

<p>Comply
with a valid legal subpoena, request, or other lawful process that meets the
requirements of our <a
href="https://asana.com/id/terms/law-enforcement-guidelines">Law Enforcement Guidelines</a></p>

<p>Help
us better understand user interests and needs, and customize the Service for
our users</p>

<p>Engage in analysis, research, and reports regarding use of
the Service</p>

<p>Protect
the Service and our users</p>

<p>Communicate
with you via email and through the Service about important notices and updates
regarding the Service, such as to inform you about changes in the Service, our
service offerings, and important services-related notices, such as about
security and fraud. Because these communications are an important part of the
Service, you may not opt out of them</p>

<p>In
accordance with applicable legal obligations, communicate with you about
promotions, offers, and news about Company. You have the ability to unsubscribe
from such promotional communications</p>

<p>Provide
cross-device management of your account. For example, we may locate or try to
locate the same unique users across multiple browsers or devices (such as
smartphones or tablets), or work with service providers that do this, in order
to save your preferences across devices and analyze usage of the Service. If
you wish to opt out of the ability of one our service providers, Google
Analytics, to locate you across devices in this way, you may install the Google
Analytics Opt-out Browser Add-on by <a
href="https://tools.google.com/dlpage/gaoptout">clicking
here</a></p>

<p>D.
Legal Bases for Use of Your Information</p>

<p>If
you are located in the EU, please note that the legal bases under the EU
General Data Protection Regulation (“GDPR”) for using the information we
collect through your use of the Service as a Free User are as follows:</p>

<p>Where
use of your information is necessary to perform our obligations under a
contract with you (for example, to comply with the <a
href="https://asana.com/id/terms/terms-of-service">User
Terms of Service</a> which you accept by using the Service)</p>

<p>Where
use of your information is necessary for our legitimate interests or the
legitimate interests of others (for example, to provide security for our
Service; operate our Service; prevent fraud, analyze use of and improve our
Service, and for similar purposes)</p>

<p>Where use of your information is necessary to comply with a
legal obligation</p>

<p>Where
we have your consent to process data in a certain way</p>

<p>E.
Sharing of Free User Information</p>

<p>We
share the information we collect through the Service about Free Users with the
following:</p>

<p>Affiliates
and Subsidiaries. We may share the information we collect within the Company
family of companies.</p>

<p>Service
Providers. We may provide access to or share your information with select third
parties that use the information only to perform services on our behalf. These
third parties provide a variety of services to us, including without limitation
sales, marketing, provision of content and features, advertising, analytics,
research, data storage, security, fraud prevention, and other services.</p>

<p>Business
Transfers. If the ownership of all or substantially all of our business
changes, we may transfer your information to the new owner so that the Websites
can continue to operate. In such case, your information would remain subject to
the promises and commitments contained in this Policy until such time as this
Policy is updated or amended by the acquiring party upon notice to you. If such
transfer is subject to additional mandatory restrictions under applicable laws,
Company will comply with such restrictions.</p>

<p>Consent.
We may also disclose your information to third parties with your consent to do
so.</p>

<p>Consistent
with your settings within the Service. Please note that the Workspace</p>

<p>Content
you submit through the Service may be viewable by other users in your
Workspace, depending on the specific settings you have selected.</p>

<p>F.&nbsp;&nbsp;&nbsp;&nbsp;
Aggregate De-Identified Data</p>

<p>We
may aggregate and/or de-identify information collected through the Service so
that such information can no longer be linked to you or your device
(“Aggregate/DeIdentified Information”). We may use Aggregate/De-Identified
Information for any purpose, including without limitation for research and
marketing purposes, and may also share such data with any third parties,
including advertisers, promotional partners, sponsors, event promoters, and/or
others.</p>

<p>G.&nbsp;&nbsp;&nbsp;
Combined Information</p>

<p>For
the purposes discussed in this Policy, we may combine the information that we
collect through the Service with information that we receive from other
sources, both online and offline, and use such combined information in
accordance with this Policy.</p>

<p>H.&nbsp;&nbsp;&nbsp;
Data Retention</p>

<p>We
will retain your information for the period necessary to fulfill the purposes
outlined in this Policy unless a longer retention period is required or
permitted by law.</p>

<p>I.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Data Subject Rights</p>

<p>Local
legal requirements (such as those in the EU) may afford you additional rights.
If you would like further information in relation to your legal rights under
applicable law or would like to exercise any of them, please contact us at any
time using <a
href="https://form-beta.asana.com/?k=u-9Ke25U6hcGWHvubWLzpg&amp;d=15793206719">this form.</a> Your local laws (such as
those in the EU) may permit you to request that we:</p>

<p>provide access to and/or a copy of certain information we
hold about you prevent the processing of your information for direct-marketing
purposes (including any direct marketing processing based on profiling)</p>

<p>update information which is out of date or incorrect delete
certain information which we are holding about you restrict the way that we
process and disclose certain of your information transfer your information to a
third party provider of services revoke your consent for the processing of your
information</p>

<p>We
will consider all requests and provide our response within the time period
stated by applicable law. Please note, however, that certain information may be
exempt from such requests in some circumstances, which may include if we need
to keep processing your information for our legitimate interests or to comply
with a legal obligation. We may request you provide us with information
necessary to confirm your identity before responding to your request.</p>

<h2>IV. Privacy Terms for
Site Visitors</h2>

<p>A.&nbsp;&nbsp;&nbsp;
Overview</p>

<p>Section
IV of this Policy applies only to Site Visitors. If you visit the Websites,
regardless of whether you are also a user of the Service, the following rules
apply to you. To eliminate any confusion, please note that the terms in this
section apply only to use of Company&apos;s Websites, not to use of the Service. If
you are a Site Visitor located in the European Union, Company is the data
controller with respect to the processing of your personal data pursuant to the
EU General Data Protection Regulation (“GDPR”).</p>

<p>B.&nbsp;&nbsp;&nbsp;
Collection and Use of Site Visitor Information</p>

<p>1.
Information Collected from Site Visitors</p>

<p>When
you use the Websites, we collect the following information about you:</p>

<p>Contact
Information – if you submit a request for information or a question through the
Websites, you may be asked to provide us with basic information including your
name, email address, phone number, and postal address. We will also keep
records of the communication, the question/request you raised, and how it was
resolved. If you choose to participate in an Company sweepstakes, contest, or
research study offered through the Websites, we will also collect basic contact
information from you in connection with such activity.</p>

<p>Websites
Usage Information – as you browse the Websites, we and our service providers
(which are third party companies that work on our behalf to provide and enhance
the Websites) use a variety of technologies, including cookies and similar
tools, to assist in collecting information about how you use the Websites. For
example, our servers automatically record certain information in server logs.
These server logs may include information such as your web request, IP address,
browser type and settings, referring / exit pages and URLs, number of clicks
and how you interact with links on the Websites, domain names, landing pages,
pages viewed, mobile carrier, mobile device identifiers and information about
the device you are using to access the Websites, date and time stamp
information and other such information.</p>

<p>Location
Information – We may collect and process general information about the location
of the device from which you are accessing the Service (e.g., approximate
geographic location inferred from an IP address).</p>

<p>2.&nbsp;&nbsp;
Cookies and Similar Technologies</p>

<p>To
collect the Websites Usage Information discussed above, we and our service
providers may use Internet server logs, cookies, tags, SDKs, tracking pixels,
and other similar tracking technologies. A web server log is a file where
website activity is stored. An SDK is a section of code that we embed in our
applications and software to allow third parties to collect information about
how users interact with the Websites. A cookie is a small text file that is
placed on your computer or mobile device when you visit a site, that enables us
to: (i) recognize your computer and login session; (ii) store your preferences
and settings; (iii) understand which pages of the Websites you have visited;
(iv), enhance your user experience by delivering and measuring the effectiveness
of content and advertising tailored to your interests; (v) perform analytics;
and (vi) assist with security and administrative functions. Tracking pixels
(sometimes referred to as web beacons or clear GIFs) are tiny electronic tags
with a unique identifier embedded in websites, online ads and/or email, and
that are designed to provide usage information like ad impressions or clicks,
email open rates, measure popularity of the Websites and associated
advertising, and to access user cookies. As we adopt additional technologies,
we may also gather information through other methods. Please note that you can
change your settings to notify you when a cookie is being set or updated, or to
block cookies altogether. Please consult the “Help” section of your browser for
more information (e.g., Internet Explorer; Google Chrome; Mozilla Firefox; or
Apple Safari).</p>

<p>3.&nbsp;&nbsp;
Use of Information Collected from Site Visitors</p>

<p>We
use the information collected from Site Visitors for a variety of purposes
including to:</p>

<p>Maintain, provide, and improve the Websites and the Service</p>

<p>Respond
to your requests for information</p>

<p>In
accordance with applicable legal obligations, communicate with you about
promotions, offers, and news about Company. You have the ability to unsubscribe
from such promotional communications</p>

<p>Prevent or address technical or security issues</p>

<p>Investigate
in good faith alleged violations of our <a
href="https://asana.com/id/terms/terms-of-service">User
Terms of Service</a></p>

<p>Help
us better understand Site Visitor interests and needs, and customize the
advertising and content you see on the Websites</p>

<p>Engage
in analysis and research regarding use of the Websites and the Service</p>

<p>C.
Legal Bases</p>

<p>If
you are located in the EU, please note that the legal bases under the GDPR for
using the information we collect through your use of the Websites as a Site
Visitor are as follows:</p>

<p>Where
use of your information is necessary to perform our obligations under a
contract with you (for example, to comply with the <a
href="https://asana.com/id/terms/terms-of-service">User
Terms of Service</a> which you accept by browsing the Websites)</p>

<p>Where
use of your information is necessary for our legitimate interests or the
legitimate interests of others (for example, to provide security for our
Websites; operate our Websites; prevent fraud, analyze use of and improve our
Websites, and for similar purposes)</p>

<p>Where use of your information is necessary to comply with a
legal obligation</p>

<p>Where
we have your consent to process data in a certain way</p>

<p>D.&nbsp;&nbsp;
Aggregate/De-Identified Data</p>

<p>We
may aggregate and/or de-identify information collected through the Websites so
that such information can no longer be linked to you or your device
(“Aggregate/DeIdentified Information”). We may use Aggregate/De-Identified
Information for any purpose, including without limitation for research and
marketing purposes, and may also share such data with any third parties,
including advertisers, promotional partners, sponsors, event promoters, and/or
others.</p>

<p>E.&nbsp;&nbsp;&nbsp;
Combined Information</p>

<p>You
agree that, for the purposes discussed in this Policy, we may combine the
information that we collect through the Websites with information that we
receive from other sources, both online and offline, and use such combined
information in accordance with this Policy. If, however, the collection of any
information about you is governed by a Customer Agreement, information will
only be combined and used in accordance with such Customer Agreement and the
sections of this Policy applicable to Subscribers.</p>

<p>F.&nbsp;&nbsp;&nbsp;&nbsp;
Website Analytics and Advertising</p>

<p>1.&nbsp;&nbsp;
Website Analytics We may use third-party web analytics
services on our Websites to collect and analyze usage information through
cookies and similar tools; engage in auditing, research, or reporting; and
provide certain features to you. To prevent</p>

<p>Google
Analytics from using your information for analytics, you may install the Google
Analytics Opt-out Browser Add-on by clicking <a
href="https://tools.google.com/dlpage/gaoptout">here</a>.</p>

<p>2.&nbsp;&nbsp;
Online Advertising</p>

<p>The
Websites may integrate third-party advertising technologies that allow for the
delivery of relevant content and advertising on the Websites, as well as on
other websites you visit. The ads may be based on various factors such as the
content of the page you are visiting, information you enter such as your age
and gender, your searches, demographic data, and other information we collect
from you. These ads may be based on your current activity or your activity over
time and across other websites and online services and may be tailored to your
interests.</p>

<p>Third
parties, whose products or services are accessible or advertised via the
Websites, may also place cookies or other tracking technologies on your
computer, mobile phone, or other device to collect information about you as
discussed above. We also allow other third parties (e.g., ad networks and ad
servers such as Google Analytics, DoubleClick and others) to serve tailored ads
to you on our Websites and other websites and to access their own cookies or
other tracking technologies on your computer, mobile phone, or other device you
use to access the Websites. We sometimes provide Site Visitor information (such
as email addresses) to service providers, who may “match” this information in
de-identified form to cookies (or mobile ad identifiers) and other proprietary
IDs, in order to provide you with more relevant ads when you visit other
websites.</p>

<p>We
neither have access to, nor does this Policy govern, the use of cookies or
other tracking technologies that may be placed on your device you use to access
the Websites by such non-affiliated third parties. If you are interested in
more information about tailored browser advertising and how you can generally
control cookies from being put on your computer to deliver tailored
advertising, you may visit the <a
href="http://optout.networkadvertising.org/">Network</a></p>

<p><a
href="http://optout.networkadvertising.org/">Advertising
Initiative&apos;s Consumer Opt-Out link</a>, the <a
href="http://optout.aboutads.info/">Digital
Advertising Alliance&apos;s </a><a href="http://optout.aboutads.info/">Consumer Opt-Out link</a>, or <a
href="http://www.youronlinechoices.eu/">Your
Online Choices</a> to opt-out of receiving tailored advertising from companies
that participate in those programs. To opt out of Google Analytics for display
advertising or customize Google display network ads, visit the <a
href="https://adssettings.google.com/authenticated">Google Ads Settings </a>page. We do not control these opt-out
links or whether any particular company chooses to participate in these opt-out
programs. We are not responsible for any choices you make using these
mechanisms or the continued availability or accuracy of these mechanisms.</p>

<p>Please
note that if you exercise the opt-out choices above, you will still see
advertising when you use the Websites, but it will not be tailored to you based
on your online behavior over time.</p>

<p>3.
Notice Concerning Do Not Track Do Not Track (“DNT”) is a privacy preference
that users can set in certain web browsers. We are committed to providing you
with meaningful choices about the information collected on our Websites for
third party purposes, and that is why we provide the variety of opt-out
mechanisms listed above.</p>

<p>However,
we do not currently recognize or respond to browser-initiated DNT signals.</p>

<p>To
learn more about Do Not Track, you can do so here.</p>

<p>G.
Sharing of Site Visitor Information</p>

<p>We
share the information we collect through the W<a
href="https://allaboutdnt.com/">ebsit</a>es with the
following:</p>

<p>Affiliates
and Subsidiaries. We may share the information we collect within the Company
family of companies.</p>

<p>Service
Providers. We may provide access to or share your information with select third
parties that use the information only to perform services on our behalf. These
third parties provide a variety of services to us, including without limitation
sales, marketing, provision of content and features, advertising, analytics,
research, data storage, security, fraud prevention, and other services.</p>

<p>Business
Transfers. If the ownership of all or substantially all of our business
changes, we may transfer your information to the new owner so that the Websites
can continue to operate. In such case, your information would remain subject to
the promises and commitments contained in this Policy until such time as this
Policy is updated or amended by the acquiring party upon notice to you. If such
transfer is subject to additional mandatory restrictions under applicable laws,
Company will comply with such restrictions.</p>

<p>Public
Forums. The Websites makes it possible for you to upload and share comments or
feedback publicly with other users, such as on the Company community forum. Any
information that you submit through such public features is not confidential,
and Company may use it for any purpose (including in testimonials or other Company
marketing materials). Any information you post openly in these ways will be
available to the public at large and potentially accessible through third-party
search engines. Such information can be read, collected and/or used by other
users, and it could be used to send you unsolicited messages. Accordingly,
please take care when using these features of the Websites.</p>

<p>Consent.
We may also disclose your information to third parties with your consent to do
so.</p>

<p>H.&nbsp;&nbsp;&nbsp;
Retention of Your Information</p>

<p>We
will retain your information for the period necessary to fulfill the purposes
outlined in this Policy unless a longer retention period is required or
permitted by law.</p>

<p>I.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Data Subject Rights</p>

<p>Local
legal requirements (such as those in the EU) may afford you additional rights.
If you would like further information in relation to your legal rights under
applicable law or would like to exercise any of them, please contact us at any
time using <a
href="https://form-beta.asana.com/?k=u-9Ke25U6hcGWHvubWLzpg&amp;d=15793206719">this form.</a> Your local laws (such as
those in the EU) may permit you to request that we:</p>

<p>provide
access to and/or a copy of certain information we hold about you prevent the
processing of your information for direct-marketing purposes (including any
direct marketing processing based on profiling) update information which is out
of date or incorrect delete certain information which we are holding about you
restrict the way that we process and disclose certain of your information
transfer your information to a third party provider of services revoke your
consent for the processing of your information</p>

<p>We
will consider all requests and provide our response within the time period
stated by applicable law. Please note, however, that certain information may be
exempt from such requests in some circumstances, which may include if we need
to keep processing your information for our legitimate interests or to comply
with a legal obligation. We may request you provide us with information
necessary to confirm your identity before responding to your request.</p>

<p>J.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
Third Party Links And Services</p>

<p>The
Websites may contain links to third-party websites and functionalities. If you
choose to use these third party services, you may disclose your information not
just to those third-parties, but also to their users and the public more
generally depending on how their services function. Because these third-party
websites and services are not operated by Company, Company is not responsible
for the content or practices of those websites or services. The collection,
use, and disclosure of your information will be subject to the privacy policies
of the third party websites or services, and not this </p>

<p>Policy.
We urge you to read the privacy and security policies of these third-parties.</p>

<h2>V. Additional Privacy
Terms for All Users</h2>

<p>The
following additional information about Company&apos;s privacy practices apply to all
users of Company (Subscribers, Free Users, and Site Visitors).</p>

<p>A.
International Users</p>

<p>Company
complies with the EU-US Privacy Shield Framework and the Swiss-US Privacy
Shield Framework as set forth by the U.S. Department of Commerce regarding the
collection, use, and retention of personal data from the European Union and </p>

<p>Switzerland
to the United States, respectively. Company has certified to the Department of </p>

<p>Commerce
that it adheres to the Privacy Shield Principles of Notice, Choice, </p>

<p>Accountability
for Onward Transfer, Security, Data Integrity and Purpose Limitation, Access
and Recourse, Enforcement and Liability. If there is any conflict between the
policies in this Policy and the Privacy Shield Principles, the Privacy Shield
Principles shall govern. To learn more about the Privacy Shield program, and to
view our certification page, please visit <a
href="https://www.privacyshield.gov/">https://www.privacyshield.gov/.</a>
In compliance with the EU-US Privacy Shield and Swiss-US Privacy Shield
Principles, Company commits to resolve complaints about your privacy and our
collection or use of your personal data. European Union or Swiss citizens with
inquiries or complaints regarding this privacy policy should first contact Company
at: privacy@fosforescent.com. Company has further committed to refer unresolved
privacy complaints under the EU-US and Swiss-US Privacy Shield Principles to an
independent dispute resolution mechanism, the BBB EU Privacy Shield, operated
by the Council of Better Business Bureaus. If you do not receive timely
acknowledgment of your complaint, or if your complaint is not satisfactorily
addressed by Company, please visit the BBB EU Privacy Shield web site at <a
href="https://www.bbb.org/EU-privacy-shield/for-eu-consumers/">https://www.bbb.org/EU</a><a
href="https://www.bbb.org/EU-privacy-shield/for-eu-consumers/">privacy-shield/for-eu-consumers/ </a>for
more information and to file a complaint. Please note that if your complaint is
not resolved through these channels, under limited circumstances, a binding
arbitration option may be available before a Privacy Shield Panel. Company is
subject to the investigatory and enforcement powers of the Federal Trade
Commission (FTC) with respect to its compliance with the provisions of the EUUS
and Swiss-US Privacy Shield.</p>

<p>We
may transfer information that we collect about you to third party processors
across borders and from your country or jurisdiction to other countries or
jurisdictions around the world. If you are located in the European Union or
other regions with laws governing data collection and use that may differ from
U.S. law, please note that you are transferring information to a country and
jurisdiction that does not have the same data protection laws as your
jurisdiction. Company will take reasonable and appropriate steps necessary to
ensure that any third party who is acting as a “data processor” under EU and
Swiss terminology is processing the personal data we entrust to them in a
manner that is consistent with the EU-US and Swiss-US Privacy Shield
Principles. Company is potentially liable in cases of onward transfer to third
parties of data of EU and Swiss individuals received pursuant to the EU-US and
Swiss-US Privacy Shield, respectively.</p>

<p>B.&nbsp;&nbsp;&nbsp;
Changes To Our Privacy Policy</p>

<p>We
reserve the right to amend this Policy at any time to reflect changes in the
law, our data collection and use practices, the features of our Service or
Websites, or advances in technology. We will make the revised Policy accessible
through the Service and Websites, so you should review the Policy periodically.
If we make a material change to the Policy, we will comply with applicable
legal requirements regarding providing you with notice and/or consent.</p>

<p>C.&nbsp;&nbsp;&nbsp;
How We Protect Your Information</p>

<p>Company
takes technical and organizational measures to protect your information against
accidental or unlawful destruction or accidental loss, alteration, unauthorized
disclosure or access. However, no method of transmission over the Internet, and
no means of electronic or physical storage, is absolutely secure, and thus we
cannot ensure or warrant the security of that information.</p>

<p>D.&nbsp;&nbsp;&nbsp;
Marketing Practices and Choices</p>

<p>If
you receive email from us, we may use certain analytics tools, such as clear
GIFs, to capture data such as when you open our message or click on any links
or banners our email contains. This data allows us to gauge the effectiveness
of our communications and marketing campaigns. You may instruct us not to use
your contact information to contact you by email, postal mail, or phone
regarding products, services, promotions and special events that might appeal
to your interests by contacting us at the “Company Contact Info” section below.
In commercial email messages, you can also opt out by following the
instructions located at the bottom of such emails. Please note that, regardless
of your request, we may still use and share certain information as permitted by
this Policy or as required by applicable law. For example, you may not opt out
of certain operational or service-related emails, such as those reflecting our
relationship or transactions with you.</p>

<p>E.&nbsp;&nbsp;&nbsp;&nbsp;
California Privacy Rights</p>

<p>California
law gives residents of California the right under certain circumstances to
request information from us regarding the manner in which we share certain
categories of personal information (as defined by applicable California law)
with third parties for their direct marketing purposes. However, Company does
not share your personal information with third parties for their own direct
marketing purposes.</p>

<h2>VI. Company Contact Info</h2>

<p>If
you wish to contact us or have any questions about or complaints in relation to
this Policy, please contact us at privacy@fosforescent.com.</p>

<p>&nbsp;</p>


          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <a className={`${buttonVariants({ variant: 'secondary' })}`} href={documents.privacy} target="_blank" rel="noreferrer">Print</a>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} >Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}