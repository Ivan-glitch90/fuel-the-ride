import { Link } from 'react-router';
import { ContactEmail, Fill, LegalPage } from './LegalPage.jsx';
import { MIN_AGE } from './legalConfig.js';
import { useLanguage } from '../i18n/index.js';
import { PrivacyPageEs } from './PrivacyPageEs.jsx';

/** Privacy Policy in the rider's language (Spanish translation in PrivacyPageEs; English prevails). */
export function PrivacyPage() {
  return useLanguage() === 'es' ? <PrivacyPageEs /> : <PrivacyPageEn />;
}

/**
 * Privacy Policy, written to GDPR-level standards for every rider wherever they live
 * (with notes for US/California). Plain language on purpose.
 */
function PrivacyPageEn() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>The short version</h2>
        <ul>
          <li>We use your data only to plan your fueling and show your progress.</li>
          <li>We never sell it, never show ads, and use no tracking or advertising cookies.</li>
          <li>Some of it is health data (weight, heart rate, what you eat). We only use it with your explicit consent.</li>
          <li>
            You can download all your data or delete your account at any time, from <Link to="/settings">Profile</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>1. Who we are</h2>
        <p>
          Fuel the Ride (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is run by <Fill field="operatorName" label="operator name" />, who
          is the data controller for the information described here. Contact for anything about your data:{' '}
          <ContactEmail />.
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li>
            <strong>Account:</strong> your email address and name. If you use a password, we store only a one-way hash
            of it (never the password itself). If you sign in with Google, we receive your Google account id, email and
            name.
          </li>
          <li>
            <strong>Profile:</strong> weight, birth year, sex, units, and (optionally) FTP, heart-rate values, trained carb
            rate, sweat rate and sweat saltiness.
          </li>
          <li>
            <strong>What you enter:</strong> your food library, ride plans, what you ate and drank, before/after weights,
            post-ride check-ins (stomach, energy, legs, bonking, cramping, notes) and events.
          </li>
          <li>
            <strong>Ride files you import:</strong> the .fit or .gpx file is read on your device and never uploaded. We
            keep only its summary: start time, duration, distance, climbing, power, kilojoules, heart rate and temperature.
            Never your GPS track or location.
          </li>
          <li>
            <strong>Technical:</strong> login cookies (see section 7); server logs with your IP address and browser type,
            used for security and kept for a short time by our hosting provider; and error reports, which are stripped of
            personal data before they leave (see section 5).
          </li>
        </ul>
        <p>
          We don&apos;t collect your location, contacts, or data from other apps, and we don&apos;t buy data about you.
        </p>
      </section>

      <section>
        <h2>3. Health data</h2>
        <p>
          Weight, heart rate, what you eat and how your body felt are <strong>health data</strong>, which privacy laws
          such as the EU&apos;s GDPR protect specially. We process it only because you gave your <strong>explicit
          consent</strong> when you signed up (or when you first used the app after this policy changed), and only to
          calculate your fueling plans, suggestions and progress. You can withdraw consent at any time by deleting your
          account; this doesn&apos;t affect what was done before.
        </p>
      </section>

      <section>
        <h2>4. Why we use it (and our legal basis)</h2>
        <ul>
          <li>
            <strong>To provide the app</strong> you signed up for: plans, logging, check-ins, events, progress
            (performance of our agreement with you).
          </li>
          <li>
            <strong>Health data</strong> for those same features (your explicit consent).
          </li>
          <li>
            <strong>Security, fixing errors and backups</strong>, so the app stays safe and reliable (our legitimate
            interests, balanced against yours: we keep this to the minimum needed).
          </li>
          <li>
            <strong>Emails</strong> to confirm your account or reset your password (performance of our agreement). We
            don&apos;t send marketing emails.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Who else handles it</h2>
        <p>We use a few service providers who process data only on our instructions:</p>
        <ul>
          <li>
            <strong>Render</strong> (hosting the app, United States).
          </li>
          <li>
            <strong>MongoDB Atlas</strong> (database, hosted on Amazon Web Services in the United States).
          </li>
          <li>
            <strong>GitHub</strong> (stores our nightly backups, which are encrypted with a key only we hold).
          </li>
          <li>
            <strong>Sentry</strong> (error reports, if enabled). Before a report is sent we remove passwords, form
            contents, cookies, email addresses, IP addresses and links from emails; it contains only your internal user
            id.
          </li>
          <li>
            <strong>Anthropic</strong> (Premium only, when you import a ride from a screenshot). The screenshot is sent to
            Anthropic’s Claude to read the ride’s numbers, and only those numbers come back. We don’t store the screenshot.
            Under Anthropic’s commercial terms it isn’t used to train AI models and is deleted within 30 days (longer only
            if flagged for misuse). Avoid screenshots that show a map of where you live.
          </li>
          <li>
            <strong>Google</strong>, only if you choose &ldquo;Continue with Google&rdquo;.
          </li>
          <li>
            <strong>An email delivery provider</strong>, to send account emails.
          </li>
        </ul>
        <p>
          We never sell or rent your data, and we don&apos;t share it for advertising. We may disclose data if the law
          requires it.
        </p>
      </section>

      <section>
        <h2>6. Where it&apos;s stored</h2>
        <p>
          Your data is stored in the United States. If you live elsewhere (for example in the EU or UK), it is transferred
          there under our providers&apos; standard data-protection terms (such as the European Commission&apos;s Standard
          Contractual Clauses).
        </p>
      </section>

      <section>
        <h2>7. Cookies and storage on your device</h2>
        <p>
          We use only the cookies needed to keep you logged in (a short-lived session cookie and a refresh cookie, both
          HTTP-only and secure). There are no analytics, advertising or tracking cookies, so there&apos;s no cookie banner.
        </p>
        <p>
          So the app opens and shows your plans without a connection, your browser keeps a copy of the app and of the
          data you last viewed (your profile, foods, rides, check-ins and events) on your device. That copy never leaves
          your device, is used only to show it back to you, and is deleted when you log out or delete your account.
          Clearing your browser&apos;s site data also removes it.
        </p>
      </section>

      <section>
        <h2>8. How long we keep it</h2>
        <ul>
          <li>While your account exists.</li>
          <li>
            When you delete your account, your data is deleted from the live database immediately. It disappears from
            encrypted backups within 90 days as those expire.
          </li>
          <li>
            Login sessions expire after 7 days and email links after 1–24 hours. Error reports (which contain no personal
            details beyond your user id) are deleted by Sentry after its retention period, at most 90 days.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. How we protect it</h2>
        <p>
          Encrypted connections (HTTPS), hashed passwords, access limited to what each part of the system needs, rate
          limits on login, and encrypted backups. No system is perfectly secure; if a breach affecting you happens, we will
          tell you and the authorities as the law requires.
        </p>
      </section>

      <section>
        <h2>10. Your rights</h2>
        <p>Wherever you live, you can:</p>
        <ul>
          <li>
            <strong>Get a copy</strong> of your data: Profile → &ldquo;Download my data&rdquo; (a JSON file you can take
            elsewhere).
          </li>
          <li>
            <strong>Correct</strong> it: edit your profile, foods and rides in the app.
          </li>
          <li>
            <strong>Delete</strong> it: Profile → &ldquo;Delete my account&rdquo;.
          </li>
          <li>
            <strong>Withdraw consent</strong>, <strong>object</strong> to or <strong>restrict</strong> processing: write to{' '}
            <ContactEmail />.
          </li>
          <li>
            <strong>Complain</strong> to your data-protection authority (in the EU/UK, the authority where you live).
          </li>
        </ul>
        <p>
          We answer requests within 30 days. California residents: we don&apos;t sell or share personal information as
          defined by the CCPA/CPRA, and you have the rights to know, delete and correct described above. We won&apos;t
          treat you differently for using any of these rights.
        </p>
      </section>

      <section>
        <h2>11. Age</h2>
        <p>
          Fuel the Ride is for people aged {MIN_AGE} and over. We don&apos;t knowingly collect data from younger children;
          if you believe a child has signed up, contact us and we&apos;ll delete the account.
        </p>
      </section>

      <section>
        <h2>12. Changes</h2>
        <p>
          If we change this policy in a way that matters, we&apos;ll update the version and date above and ask you to
          agree again in the app before you continue.
        </p>
      </section>
    </LegalPage>
  );
}
