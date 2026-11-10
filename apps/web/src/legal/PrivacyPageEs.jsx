import { Link } from 'react-router';
import { ContactEmail, Fill, LegalPage } from './LegalPage.jsx';
import { MIN_AGE } from './legalConfig.js';

/**
 * Política de privacidad: traducción al español de PrivacyPage (la versión en inglés prevalece).
 * Mantén las mismas secciones y numeración que el original al cambiar cualquiera de los dos.
 */
export function PrivacyPageEs() {
  return (
    <LegalPage title="Política de privacidad">
      <section>
        <h2>En resumen</h2>
        <ul>
          <li>Usamos tus datos solo para planear tu alimentación y mostrarte tu progreso.</li>
          <li>Nunca los vendemos, nunca mostramos anuncios y no usamos cookies de seguimiento ni de publicidad.</li>
          <li>
            Algunos son datos relativos a la salud (peso, frecuencia cardiaca, lo que comes). Solo los usamos con tu
            consentimiento explícito.
          </li>
          <li>
            Puedes descargar todos tus datos o eliminar tu cuenta en cualquier momento, desde{' '}
            <Link to="/settings">Perfil</Link>.
          </li>
        </ul>
      </section>

      <p className="muted">
        En caso de discrepancia entre esta traducción y la versión en inglés, prevalece la versión en inglés.
      </p>

      <section>
        <h2>1. Quiénes somos</h2>
        <p>
          Fuel the Ride (&ldquo;nosotros&rdquo;) es operado por <Fill field="operatorName" label="nombre del operador" />,
          quien es el responsable del tratamiento de la información que se describe aquí. Contacto para cualquier asunto
          sobre tus datos: <ContactEmail />.
        </p>
      </section>

      <section>
        <h2>2. Qué datos recopilamos</h2>
        <ul>
          <li>
            <strong>Cuenta:</strong> tu dirección de correo electrónico y tu nombre. Si usas una contraseña, solo
            guardamos un hash unidireccional de ella (nunca la contraseña en sí). Si inicias sesión con Google, recibimos
            el identificador de tu cuenta de Google, tu correo y tu nombre.
          </li>
          <li>
            <strong>Perfil:</strong> peso, año de nacimiento, sexo, unidades y (de forma opcional) FTP, valores de
            frecuencia cardiaca, tolerancia de carbohidratos, tasa de sudoración y qué tan salado es tu sudor.
          </li>
          <li>
            <strong>Lo que ingresas:</strong> tu lista de alimentos, planes de salida, lo que comiste y bebiste, tu peso
            antes y después, las revisiones después de la salida (estómago, energía, piernas, si te quedaste sin energía,
            calambres, notas) y los eventos.
          </li>
          <li>
            <strong>Datos técnicos:</strong> cookies de inicio de sesión (consulta la sección 7); registros del servidor
            con tu dirección IP y tipo de navegador, que se usan por seguridad y que nuestro proveedor de alojamiento
            conserva por poco tiempo; e informes de errores, de los que se eliminan los datos personales antes de que
            salgan (consulta la sección 5).
          </li>
        </ul>
        <p>
          No recopilamos tu ubicación, tus contactos ni datos de otras aplicaciones, y no compramos datos sobre ti.
        </p>
      </section>

      <section>
        <h2>3. Datos relativos a la salud</h2>
        <p>
          El peso, la frecuencia cardiaca, lo que comes y cómo se sintió tu cuerpo son <strong>datos relativos a la
          salud</strong>, que las leyes de privacidad, como el Reglamento General de Protección de Datos (RGPD) de la UE,
          protegen de forma especial. Los tratamos solo porque diste tu <strong>consentimiento explícito</strong> al
          registrarte (o la primera vez que usaste la app después de que cambió esta política), y solo para calcular tus
          planes de alimentación, sugerencias y progreso. Puedes retirar tu consentimiento en cualquier momento eliminando
          tu cuenta; esto no afecta al tratamiento realizado antes.
        </p>
      </section>

      <section>
        <h2>4. Para qué los usamos (y nuestra base jurídica)</h2>
        <ul>
          <li>
            <strong>Para prestarte la app</strong> en la que te registraste: planes, registros, revisiones, eventos,
            progreso (ejecución de nuestro contrato contigo).
          </li>
          <li>
            <strong>Datos relativos a la salud</strong> para esas mismas funciones (tu consentimiento explícito).
          </li>
          <li>
            <strong>Seguridad, corrección de errores y copias de seguridad</strong>, para que la app siga siendo segura y
            confiable (nuestro interés legítimo, ponderado frente a los tuyos: lo limitamos al mínimo necesario).
          </li>
          <li>
            <strong>Correos electrónicos</strong> para confirmar tu cuenta o restablecer tu contraseña (ejecución de
            nuestro contrato). No enviamos correos de marketing.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Quién más los trata</h2>
        <p>Usamos algunos proveedores de servicios, encargados del tratamiento que tratan los datos solo según nuestras instrucciones:</p>
        <ul>
          <li>
            <strong>Render</strong> (alojamiento de la app, Estados Unidos).
          </li>
          <li>
            <strong>MongoDB Atlas</strong> (base de datos, alojada en Amazon Web Services en Estados Unidos).
          </li>
          <li>
            <strong>GitHub</strong> (guarda nuestras copias de seguridad nocturnas, cifradas con una clave que solo
            nosotros tenemos).
          </li>
          <li>
            <strong>Sentry</strong> (informes de errores, si está activado). Antes de enviar un informe eliminamos
            contraseñas, contenido de formularios, cookies, direcciones de correo electrónico, direcciones IP y enlaces de
            los correos; solo contiene tu identificador interno de usuario.
          </li>
          <li>
            <strong>Google</strong>, solo si eliges &ldquo;Continuar con Google&rdquo;.
          </li>
          <li>
            <strong>Un proveedor de envío de correos electrónicos</strong>, para enviar los correos de la cuenta.
          </li>
        </ul>
        <p>
          Nunca vendemos ni alquilamos tus datos, y no los compartimos con fines publicitarios. Podemos divulgar datos si
          la ley lo exige.
        </p>
      </section>

      <section>
        <h2>6. Dónde se guardan</h2>
        <p>
          Tus datos se guardan en Estados Unidos. Si vives en otro lugar (por ejemplo, en la UE o el Reino Unido), se
          transfieren allí conforme a las condiciones estándar de protección de datos de nuestros proveedores (como las
          cláusulas contractuales tipo de la Comisión Europea).
        </p>
      </section>

      <section>
        <h2>7. Cookies y almacenamiento en tu dispositivo</h2>
        <p>
          Solo usamos las cookies necesarias para mantener tu sesión iniciada (una cookie de sesión de corta duración y una
          cookie de renovación, ambas HTTP-only y seguras). No hay cookies de analítica, publicidad ni seguimiento, por eso
          no hay aviso de cookies.
        </p>
        <p>
          Para que la app abra y muestre tus planes sin conexión, tu navegador guarda en tu dispositivo una copia de la app
          y de los últimos datos que viste (tu perfil, alimentos, salidas, revisiones y eventos). Esa copia nunca sale de
          tu dispositivo, solo se usa para volver a mostrártela y se elimina cuando cierras sesión o eliminas tu cuenta.
          Borrar los datos del sitio en tu navegador también la elimina.
        </p>
      </section>

      <section>
        <h2>8. Cuánto tiempo los conservamos</h2>
        <ul>
          <li>Mientras exista tu cuenta.</li>
          <li>
            Cuando eliminas tu cuenta, tus datos se eliminan de inmediato de la base de datos activa. Desaparecen de las
            copias de seguridad cifradas en un plazo de 90 días, a medida que estas caducan.
          </li>
          <li>
            Las sesiones de inicio de sesión caducan a los 7 días y los enlaces enviados por correo, entre 1 y 24 horas.
            Sentry elimina los informes de errores (que no contienen datos personales más allá de tu identificador de
            usuario) al terminar su periodo de conservación, de 90 días como máximo.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Cómo los protegemos</h2>
        <p>
          Conexiones cifradas (HTTPS), contraseñas con hash, acceso limitado a lo que cada parte del sistema necesita,
          límites de intentos de inicio de sesión y copias de seguridad cifradas. Ningún sistema es perfectamente seguro;
          si ocurre una violación de seguridad que te afecte, te lo comunicaremos a ti y a las autoridades según lo exija la
          ley.
        </p>
      </section>

      <section>
        <h2>10. Tus derechos</h2>
        <p>Vivas donde vivas, puedes:</p>
        <ul>
          <li>
            <strong>Obtener una copia</strong> de tus datos (derechos de acceso y portabilidad): Perfil →
            &ldquo;Descargar mis datos&rdquo; (un archivo JSON que puedes llevar a otro lugar).
          </li>
          <li>
            <strong>Corregirlos</strong> (derecho de rectificación): edita tu perfil, alimentos y salidas en la app.
          </li>
          <li>
            <strong>Eliminarlos</strong> (derecho de supresión): Perfil → &ldquo;Eliminar mi cuenta&rdquo;.
          </li>
          <li>
            <strong>Retirar tu consentimiento</strong>, <strong>oponerte</strong> al tratamiento o pedir que lo{' '}
            <strong>limitemos</strong>: escribe a <ContactEmail />.
          </li>
          <li>
            <strong>Presentar una reclamación</strong> ante tu autoridad de protección de datos (en la UE o el Reino Unido,
            la autoridad del lugar donde vives).
          </li>
        </ul>
        <p>
          Respondemos las solicitudes en un plazo de 30 días. Residentes de California: no vendemos ni compartimos
          información personal según la definición de la Ley de Privacidad del Consumidor de California (CCPA/CPRA), y
          tienes los derechos a saber, eliminar y corregir descritos arriba. No te trataremos de forma diferente por
          ejercer cualquiera de estos derechos.
        </p>
      </section>

      <section>
        <h2>11. Edad</h2>
        <p>
          Fuel the Ride es para personas de {MIN_AGE} años o más. No recopilamos a sabiendas datos de menores de esa edad;
          si crees que un menor se registró, contáctanos y eliminaremos la cuenta.
        </p>
      </section>

      <section>
        <h2>12. Cambios</h2>
        <p>
          Si cambiamos esta política de forma relevante, actualizaremos la versión y la fecha que aparecen arriba y te
          pediremos que la aceptes de nuevo en la app antes de continuar.
        </p>
      </section>
    </LegalPage>
  );
}
