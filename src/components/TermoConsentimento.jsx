import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/session.jsx';
import { useTheme } from '../lib/theme.jsx';

export const TERMO_VERSAO = '1.0';

// ─────────────────────────────────────────────────────────────────────────────
// Tela de loading
// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--muted)', fontSize: 13,
      fontFamily: 'var(--font-sans)',
    }}>
      Carregando…
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tela de período encerrado
// ─────────────────────────────────────────────────────────────────────────────
function ExpiracaoScreen({ nutriNome }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: 32,
      textAlign: 'center', fontFamily: 'var(--font-sans)',
      background: 'var(--bg, #faf8f5)',
    }}>
      <i className="ti ti-calendar-off" style={{ fontSize: 52, color: 'var(--muted)', marginBottom: 20 }} aria-hidden="true"></i>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 12, color: 'var(--dark)' }}>
        Período de acompanhamento encerrado
      </div>
      <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 380 }}>
        Seu período de acompanhamento foi encerrado. Entre em contato com a{' '}
        <strong style={{ color: 'var(--dark)' }}>{nutriNome}</strong> para contratar um novo plano.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto do contrato
// ─────────────────────────────────────────────────────────────────────────────
function ContratoTexto({ nome, tipoBR, valorBR, dataInicioBR, modalidade }) {
  const P = ({ style, children }) => (
    <p style={{ marginBottom: 8, ...style }}>{children}</p>
  );
  const H = ({ children }) => (
    <p style={{ fontWeight: 700, marginTop: 16, marginBottom: 4 }}>{children}</p>
  );
  const modalidadeBR = modalidade === 'Presencial' ? 'Presencial' : 'Online';

  return (
    <div style={{ fontSize: 12, lineHeight: 1.75, color: '#2b2b2b' }}>
      <P style={{ fontWeight: 700, textAlign: 'center', fontSize: 13, marginBottom: 16 }}>
        CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE NUTRIÇÃO CLÍNICA
      </P>

      <P><strong>CONTRATADA:</strong> Júlia Barbosa Pinheiro, Nutricionista, CRN 20100737, CPF 166.485.087-28.</P>
      <P><strong>CONTRATANTE:</strong> {nome}.</P>

      <H>CLÁUSULA 1ª — DO OBJETO</H>
      <P>Prestação de serviços de acompanhamento nutricional individualizado.</P>

      <H>CLÁUSULA 2ª — DO PLANO CONTRATADO</H>
      <P>
        A CONTRATANTE optou pelo plano <strong>{tipoBR}</strong>, no valor de{' '}
        <strong>R$ {valorBR}</strong>, com início em <strong>{dataInicioBR}</strong>.
      </P>
      <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
        <li>Plano Avulso: 1 consulta.</li>
        <li>Plano Trimestral: consultas em 3 meses consecutivos a partir da assinatura.</li>
        <li>Plano Semestral: consultas em 6 meses consecutivos a partir da assinatura.</li>
      </ul>
      <P>Cada consulta ocorrerá em intervalos de 30 dias corridos.</P>

      <H>CLÁUSULA 3ª — DA MODALIDADE DE ATENDIMENTO</H>
      <P>
        O atendimento será realizado na modalidade <strong>{modalidadeBR}</strong>, conforme
        escolha da CONTRATANTE no ato da contratação.
      </P>
      {modalidadeBR === 'Presencial' ? (
        <P>Modalidade Presencial: as consultas ocorrerão em local a ser informado pela CONTRATADA.</P>
      ) : (
        <P>Modalidade Online: as consultas ocorrerão por videochamada em plataforma digital a ser definida pela CONTRATADA.</P>
      )}

      <H>CLÁUSULA 4ª — DA PRESCRIÇÃO DIETÉTICA</H>
      <P>O plano alimentar será entregue em até 3 dias úteis após cada consulta.</P>

      <H>CLÁUSULA 5ª — DO PAGAMENTO</H>
      <P>
        O valor total de R$ {valorBR} foi integralmente pago pela CONTRATANTE previamente ao
        acesso ao plano, sendo condição para utilização dos serviços.
      </P>

      <H>CLÁUSULA 6ª — DO AGENDAMENTO, REMARCAÇÃO E CANCELAMENTO</H>
      <P>6.1. Remarcações ou cancelamentos somente serão aceitos com antecedência mínima de 24 horas.</P>
      <P>6.2. Cancelamentos com menos de 24 horas serão considerados consulta realizada, sem direito a reposição ou reembolso.</P>

      <H>CLÁUSULA 7ª — DA INTRANSFERIBILIDADE</H>
      <P>7.1. Os serviços são pessoais e intransferíveis, não podendo ser cedidos a terceiros.</P>
      <P>7.2. Consultas não utilizadas dentro do período contratado serão perdidas, sem transferência para meses subsequentes.</P>

      <H>CLÁUSULA 8ª — DAS RESPONSABILIDADES</H>
      <P>8.1. A CONTRATADA prestará os serviços com ética e conforme as normas do CFN.</P>
      <P>8.2. A CONTRATANTE é responsável pelas informações fornecidas sobre seu estado de saúde.</P>

      <H>CLÁUSULA 9ª — DA RESCISÃO</H>
      <P>
        9.1. A rescisão por iniciativa da CONTRATANTE somente será aceita mediante comunicação
        prévia de até 3 dias úteis antes da data de entrega do plano alimentar.
      </P>
      <P>
        9.2. Em hipótese alguma haverá reembolso em caso de rescisão por iniciativa da
        CONTRATANTE, pelos seguintes motivos: (a) os planos Trimestral e Semestral são
        contratados com valor diferenciado em razão do compromisso pelo período integral;
        (b) o plano Avulso implica consulta já realizada; (c) a CONTRATADA reserva agenda
        exclusiva para a CONTRATANTE, incorrendo em perda financeira direta em caso de
        desistência; (d) o pagamento integral é condição de acesso ao plano.
      </P>
      <P>
        9.3. Em caso de rescisão por iniciativa da CONTRATADA sem justo motivo, será devolvido
        o valor proporcional às consultas não realizadas.
      </P>

      <H>CLÁUSULA 10ª — DO FORO</H>
      <P>
        Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir quaisquer litígios,
        nos termos do Código Civil Brasileiro e da Lei nº 14.063/2020.
      </P>

      <P style={{ marginTop: 16 }}>Rio de Janeiro, {dataInicioBR}.</P>
      <P><strong>CONTRATADA:</strong> Júlia Barbosa Pinheiro — CRN 20100737</P>
      <P><strong>CONTRATANTE:</strong> {nome}</P>

      <P style={{ marginTop: 14, fontStyle: 'italic', color: '#666', fontSize: 11 }}>
        Ao marcar abaixo, a CONTRATANTE declara ter lido e concordado com os termos, conferindo
        validade de assinatura eletrônica nos termos da Lei nº 14.063/2020.
      </P>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de aceite do contrato
// ─────────────────────────────────────────────────────────────────────────────
function ModalContrato({ contrato, profile, user, onAceite }) {
  const [checado, setChecado] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState(null);

  const TIPO_BR = { avulso: 'Avulso', trimestral: 'Trimestral', semestral: 'Semestral' };
  const tipoBR = TIPO_BR[contrato.tipo_plano] ?? contrato.tipo_plano;
  const valorBR = Number(contrato.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataInicioBR = new Date(contrato.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  async function aceitar() {
    if (!checado || aceitando) return;
    setAceitando(true); setErro(null);
    let ip = null;
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      ip = (await r.json()).ip;
    } catch {}
    const { error } = await supabase
      .from('contratos_pacientes')
      .update({ aceito: true, data_aceite: new Date().toISOString(), ip_aceite: ip })
      .eq('id', contrato.id);
    if (error) { setAceitando(false); setErro('Erro ao salvar: ' + error.message); return; }
    // Marca LGPD para não re-exibir em fallback
    await supabase.from('pacientes')
      .update({ termo_aceito_em: new Date().toISOString(), termo_versao: TERMO_VERSAO })
      .eq('id', user.id);
    onAceite();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg, #faf8f5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 16, maxWidth: 640, width: '100%',
        maxHeight: 'calc(100dvh - 32px)', boxShadow: '0 10px 40px rgba(0,0,0,.14)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 14px', borderBottom: '0.5px solid var(--hair, #e6dfd0)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold-deep, #a08456)', fontWeight: 500, marginBottom: 4 }}>
            Antes de começar
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink, #2b2b2b)' }}>
            Contrato de Prestação de Serviços
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted, #999)', marginTop: 4 }}>
            Leia com atenção — o aceite tem validade de assinatura eletrônica (Lei nº 14.063/2020).
          </div>
        </div>

        {/* Corpo do contrato — rola internamente */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <ContratoTexto
            nome={profile?.nome ?? ''}
            tipoBR={tipoBR}
            valorBR={valorBR}
            dataInicioBR={dataInicioBR}
            modalidade={profile?.modalidade ?? 'Online'}
          />
        </div>

        {/* Footer fixo — sempre visível */}
        <div style={{ padding: '14px 24px 22px', borderTop: '0.5px solid var(--hair, #e6dfd0)', flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox" checked={checado} onChange={e => setChecado(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, accentColor: '#2b2b2b', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: 'var(--ink, #2b2b2b)', lineHeight: 1.5 }}>
              Li e aceito os termos do contrato.
            </span>
          </label>

          {erro && (
            <div style={{
              background: 'var(--red-bg, #ffe9e6)', color: 'var(--red, #c93b3b)',
              padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
            }}>{erro}</div>
          )}

          <button
            onClick={aceitar} disabled={!checado || aceitando}
            style={{
              width: '100%', padding: '14px 18px',
              background: checado ? '#2b2b2b' : '#ccc', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500,
              cursor: checado ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)',
              transition: 'background .2s',
            }}>
            {aceitando ? 'Salvando...' : 'Confirmar e acessar o app'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--muted, #999)', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
            Se preferir não aceitar, feche o app e fale com sua nutricionista.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate de LGPD legado — para pacientes sem contrato (cadastradas antes desta feature)
// ─────────────────────────────────────────────────────────────────────────────
const LGPD_HTML = `
<h3>1. Sobre este aplicativo</h3>
<p>Este aplicativo é uma plataforma de acompanhamento nutricional entre você e sua nutricionista. Os dados aqui registrados são <strong>privados</strong> e visíveis apenas pra você e pra sua nutricionista.</p>
<h3>2. Dados que coletamos</h3>
<ul>
  <li><strong>Cadastro:</strong> nome, e-mail, data de nascimento.</li>
  <li><strong>Saúde:</strong> peso, medidas, % de gordura, fotos de evolução.</li>
  <li><strong>Comportamento:</strong> aderência ao plano, suplementos, check-ins.</li>
  <li><strong>Comunicação:</strong> histórico de mensagens com a nutricionista.</li>
</ul>
<h3>3. Como usamos</h3>
<p>Dados usados <strong>exclusivamente</strong> para acompanhamento. <strong>Não compartilhamos com terceiros.</strong></p>
<h3>4. Seus direitos (LGPD)</h3>
<p>Você pode solicitar cópia, correção ou exclusão dos seus dados a qualquer momento pelo chat.</p>
<h3>5. Segurança</h3>
<p>Dados armazenados em servidores criptografados (Supabase), com acesso por sessão autenticada.</p>
`;

function LGPDGate({ profile, user, refreshProfile, children }) {
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState(null);

  if (profile.termo_aceito_em && profile.termo_versao === TERMO_VERSAO) return children;

  async function aceitar() {
    setErro(null); setAceitando(true);
    const { error } = await supabase.from('pacientes').update({
      termo_aceito_em: new Date().toISOString(),
      termo_versao: TERMO_VERSAO,
    }).eq('id', user.id);
    setAceitando(false);
    if (error) { setErro('Não foi possível salvar: ' + error.message); return; }
    if (typeof refreshProfile === 'function') await refreshProfile();
    else window.location.reload();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg, #f5f1e8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 16, maxWidth: 560, width: '100%',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,.15)',
      }}>
        <div style={{ padding: '20px 24px 12px', borderBottom: '0.5px solid var(--hair, #e6dfd0)' }}>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold-deep, #a08456)', fontWeight: 500, marginBottom: 4 }}>
            Antes de começar
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink, #2b2b2b)' }}>Termo de uso e privacidade</div>
          <div style={{ fontSize: 12, color: 'var(--muted, #999)', marginTop: 4 }}>Proteção dos seus dados (LGPD)</div>
        </div>
        <div style={{ padding: '16px 24px', overflow: 'auto', flex: 1, fontSize: 13, lineHeight: 1.6, color: 'var(--ink, #2b2b2b)' }}
          dangerouslySetInnerHTML={{ __html: LGPD_HTML }} />
        {erro && (
          <div style={{ margin: '0 24px 8px', padding: '8px 12px', background: 'var(--red-bg, #ffe9e6)', color: 'var(--red, #c93b3b)', borderRadius: 8, fontSize: 12 }}>
            {erro}
          </div>
        )}
        <div style={{ padding: '14px 24px 18px', borderTop: '0.5px solid var(--hair, #e6dfd0)' }}>
          <button onClick={aceitar} disabled={aceitando} style={{
            width: '100%', padding: '14px 18px', background: '#2b2b2b', color: '#ffffff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: aceitando ? 0.7 : 1,
          }}>
            {aceitando ? 'Salvando...' : 'Aceito e continuar'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--muted, #999)', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
            Se preferir não aceitar, feche o app e fale com sua nutricionista.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function TermoConsentimento({ children }) {
  const { user, profile, role, refreshProfile } = useSession();
  const tema = useTheme();
  const [contrato, setContrato] = useState(undefined); // undefined=loading, null=sem contrato, obj=encontrou

  useEffect(() => {
    if (!user || role !== 'paciente') return;
    supabase
      .from('contratos_pacientes')
      .select('id, tipo_plano, valor, data_inicio, aceito, data_aceite')
      .eq('paciente_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setContrato(data ?? null));
  }, [user?.id, role]);

  // Não é paciente — passa direto
  if (role !== 'paciente' || !profile) return children;

  // Aguardando consulta ao contrato
  if (contrato === undefined) return <LoadingScreen />;

  // Sem contrato na tabela → paciente antiga, usa gate LGPD legado
  if (contrato === null) {
    return (
      <LGPDGate profile={profile} user={user} refreshProfile={refreshProfile}>
        {children}
      </LGPDGate>
    );
  }

  // Contrato existe mas não aceito → exibe modal de contrato
  if (!contrato.aceito) {
    return (
      <ModalContrato
        contrato={contrato}
        profile={profile}
        user={user}
        onAceite={() => setContrato(c => ({ ...c, aceito: true, data_aceite: new Date().toISOString() }))}
      />
    );
  }

  // Contrato aceito → verifica expiração
  if (contrato.tipo_plano !== 'avulso') {
    const meses = contrato.tipo_plano === 'trimestral' ? 3 : 6;
    const expira = new Date(contrato.data_inicio + 'T12:00:00');
    expira.setMonth(expira.getMonth() + meses);
    if (new Date() > expira) {
      return <ExpiracaoScreen nutriNome={tema.nutri_nome ?? 'Nutricionista Júlia Pinheiro'} />;
    }
  }

  return children;
}
