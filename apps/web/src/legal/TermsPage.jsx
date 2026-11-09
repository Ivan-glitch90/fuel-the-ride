import { Link } from 'react-router';
import { ContactEmail, Fill, LegalPage } from './LegalPage.jsx';
import { MIN_AGE } from './legalConfig.js';

/** Terms of Use. The medical disclaimer is deliberately prominent. */
export function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <section className="legal-callout" aria-labelledby="medical-title">
        <h2 id="medical-title">Not medical advice</h2>
        <p>
          Fuel the Ride gives <strong>general sports-nutrition guidance</strong> based on published ranges and the numbers
          you enter. It is <strong>not medical advice</strong> and doesn&apos;t replace a doctor or registered dietitian.
        </p>
        <p>
          <strong>Talk to a doctor before following any plan</strong> if you have diabetes, kidney, heart or blood-pressure
          conditions, a history of eating disorders or hyponatremia, are pregnant, or take medication affected by diet,
          fluids or sodium.
        </p>
        <p>
          Stop and get help if you feel unwell while riding. Drinking far more than you sweat can be dangerous; the app
          caps fluid targets for that reason, but you know your body best.
        </p>
      </section>

      <section>
        <h2>1. Agreement</h2>
        <p>
          These terms are an agreement between you and <Fill field="operatorName" label="operator name" />, who runs Fuel
          the Ride. By creating an account you agree to them and to the <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>2. Who can use it</h2>
        <p>
          You must be at least {MIN_AGE} years old. You&apos;re responsible for your account: keep your password private
          and tell us if you think someone else is using it.
        </p>
      </section>

      <section>
        <h2>3. Your data and content</h2>
        <p>
          What you enter stays yours. You give us permission to store and process it only to run the app for you, as
          described in the Privacy Policy. You can download it or delete your account at any time from Profile.
        </p>
      </section>

      <section>
        <h2>4. Fair use</h2>
        <p>
          Don&apos;t misuse the app: no attempts to access other people&apos;s data, break or overload the service, or use it
          for anything unlawful. We may suspend accounts that do.
        </p>
      </section>

      <section>
        <h2>5. The service</h2>
        <p>
          The app is free and provided &ldquo;as is&rdquo;. We work to keep it accurate and available but can&apos;t promise
          it will always be error-free or online, and we may change or discontinue features. Plans are estimates: check them
          against how you actually feel and adjust.
        </p>
      </section>

      <section>
        <h2>6. Limits of liability</h2>
        <p>
          To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, or for how you use the
          guidance. Nothing in these terms limits liability that can&apos;t be limited by law (for example for death or
          personal injury caused by negligence), or your rights as a consumer where you live.
        </p>
      </section>

      <section>
        <h2>7. Ending</h2>
        <p>
          You can stop using the app and delete your account whenever you like. We may end or suspend access for breaches
          of these terms, and will tell you why when we can.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          If these terms change in a way that matters, we&apos;ll update the version and date above and ask you to agree
          again in the app.
        </p>
      </section>

      <section>
        <h2>9. Law and contact</h2>
        <p>
          These terms are governed by the laws of <Fill field="governingLaw" label="governing law" />, without taking away
          the protection of the consumer laws where you live. Questions: <ContactEmail />.
        </p>
      </section>
    </LegalPage>
  );
}
