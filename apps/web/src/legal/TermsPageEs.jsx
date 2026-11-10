import { Link } from 'react-router';
import { ContactEmail, Fill, LegalPage } from './LegalPage.jsx';
import { LEGAL, MIN_AGE } from './legalConfig.js';

/** Spanish wording for known legalConfig.governingLaw values; anything else is shown as configured. */
const GOVERNING_LAW_ES = { 'the State of Washington, USA': 'el estado de Washington (EE. UU.)' };

function GoverningLaw() {
  const spanish = GOVERNING_LAW_ES[LEGAL.governingLaw];
  return spanish ? <>{spanish}</> : <Fill field="governingLaw" label="ley aplicable" />;
}

/**
 * Términos de uso: traducción al español de TermsPage (la versión en inglés prevalece).
 * El aviso médico va destacado a propósito. Mantén la misma estructura que el original.
 */
export function TermsPageEs() {
  return (
    <LegalPage title="Términos de uso">
      <section className="legal-callout" aria-labelledby="medical-title">
        <h2 id="medical-title">No es consejo médico</h2>
        <p>
          Fuel the Ride ofrece <strong>orientación general sobre nutrición deportiva</strong> basada en rangos publicados
          y en los números que ingresas. <strong>No es consejo médico</strong> y no reemplaza a un médico ni a un
          nutricionista o dietista certificado.
        </p>
        <p>
          <strong>Consulta a un médico antes de seguir cualquier plan</strong> si tienes diabetes, enfermedades renales,
          cardiacas o de presión arterial, antecedentes de trastornos de la conducta alimentaria o de hiponatremia, si estás
          embarazada o si tomas medicamentos que se ven afectados por la dieta, los líquidos o el sodio.
        </p>
        <p>
          Detente y pide ayuda si te sientes mal mientras pedaleas. Beber mucho más de lo que sudas puede ser peligroso; por
          eso la app limita los objetivos de líquidos, pero nadie conoce tu cuerpo mejor que tú.
        </p>
      </section>

      <p className="muted">
        En caso de discrepancia entre esta traducción y la versión en inglés, prevalece la versión en inglés.
      </p>

      <section>
        <h2>1. Acuerdo</h2>
        <p>
          Estos términos son un acuerdo entre tú y <Fill field="operatorName" label="nombre del operador" />, quien opera
          Fuel the Ride. Al crear una cuenta, aceptas estos términos y la <Link to="/privacy">Política de privacidad</Link>.
        </p>
      </section>

      <section>
        <h2>2. Quién puede usarla</h2>
        <p>
          Debes tener al menos {MIN_AGE} años. Eres responsable de tu cuenta: mantén tu contraseña en privado y avísanos si
          crees que otra persona la está usando.
        </p>
      </section>

      <section>
        <h2>3. Tus datos y tu contenido</h2>
        <p>
          Lo que ingresas sigue siendo tuyo. Nos das permiso para guardarlo y tratarlo solo para hacer funcionar la app para
          ti, como se describe en la Política de privacidad. Puedes descargarlo o eliminar tu cuenta en cualquier momento
          desde Perfil.
        </p>
      </section>

      <section>
        <h2>4. Uso adecuado</h2>
        <p>
          No hagas un uso indebido de la app: no intentes acceder a los datos de otras personas, dañar o sobrecargar el
          servicio, ni usarla para nada ilegal. Podemos suspender las cuentas que lo hagan.
        </p>
      </section>

      <section>
        <h2>5. El servicio</h2>
        <p>
          La app es gratuita y se ofrece &ldquo;tal cual&rdquo;. Trabajamos para que sea precisa y esté disponible, pero no
          podemos prometer que siempre esté libre de errores o en línea, y podemos cambiar o dejar de ofrecer funciones. Los
          planes son estimaciones: compáralos con cómo te sientes realmente y ajústalos.
        </p>
      </section>

      <section>
        <h2>6. Limitación de responsabilidad</h2>
        <p>
          En la medida en que la ley lo permita, no somos responsables de pérdidas indirectas o consecuentes, ni de la
          forma en que uses la orientación. Nada en estos términos limita la responsabilidad que la ley no permite limitar
          (por ejemplo, por muerte o lesiones personales causadas por negligencia), ni tus derechos como consumidor en el
          lugar donde vives.
        </p>
      </section>

      <section>
        <h2>7. Terminación</h2>
        <p>
          Puedes dejar de usar la app y eliminar tu cuenta cuando quieras. Podemos terminar o suspender tu acceso por
          incumplimientos de estos términos y, cuando podamos, te diremos por qué.
        </p>
      </section>

      <section>
        <h2>8. Cambios</h2>
        <p>
          Si estos términos cambian de forma relevante, actualizaremos la versión y la fecha que aparecen arriba y te
          pediremos que los aceptes de nuevo en la app.
        </p>
      </section>

      <section>
        <h2>9. Ley aplicable y contacto</h2>
        <p>
          Estos términos se rigen por las leyes de <GoverningLaw />, sin que ello te
          prive de la protección de las leyes de consumo del lugar donde vives. Preguntas: <ContactEmail />.
        </p>
      </section>
    </LegalPage>
  );
}
