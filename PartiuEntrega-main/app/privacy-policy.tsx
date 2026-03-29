import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_NAME = 'PartiuEntrega';
const CONTACT_EMAIL = 'privacidade@partiuentrega.com.br';

type SectionProps = { title: string; children: React.ReactNode };
function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={styles.para}>{children}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de Privacidade</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Última atualização: março de 2026</Text>

        <Para>
          O {APP_NAME} respeita a sua privacidade e está comprometido com a proteção dos seus dados pessoais,
          em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018) e demais normas aplicáveis.
        </Para>

        <Section title="1. Dados coletados">
          <Para>Coletamos os seguintes dados pessoais:</Para>
          <Bullet text="Dados de identificação: nome completo, CPF, e-mail, telefone" />
          <Bullet text="Documentos: CNH (frente e verso ou digital em PDF)" />
          <Bullet text="Selfie para verificação de identidade" />
          <Bullet text="Dados do veículo: marca, modelo, placa, ano" />
          <Bullet text="Dados de localização: cidade, estado" />
          <Bullet text="Dados de pagamento: informações de assinatura via Mercado Pago (não armazenamos dados de cartão)" />
          <Bullet text="Histórico de entregas e atividade na plataforma" />
        </Section>

        <Section title="2. Finalidade do uso">
          <Para>Seus dados são utilizados para:</Para>
          <Bullet text="Verificação de identidade e habilitação de entregadores" />
          <Bullet text="Operação da plataforma de entregas" />
          <Bullet text="Processamento de pagamentos de assinatura" />
          <Bullet text="Cálculo de distâncias e rotas de entrega" />
          <Bullet text="Comunicação sobre o status do cadastro" />
          <Bullet text="Cumprimento de obrigações legais e regulatórias" />
          <Bullet text="Prevenção de fraudes e segurança da plataforma" />
        </Section>

        <Section title="3. Armazenamento e segurança">
          <Para>
            Os documentos enviados (CNH e selfie) são armazenados de forma criptografada em servidores seguros.
            O acesso é restrito exclusivamente a administradores autorizados da plataforma.
            Arquivos são armazenados por até 5 anos após o encerramento da conta ou conforme exigência legal.
          </Para>
        </Section>

        <Section title="4. Compartilhamento de dados">
          <Para>
            Não vendemos, alugamos ou cedemos seus dados a terceiros. Compartilhamos informações apenas quando
            necessário para:
          </Para>
          <Bullet text="Processadores de pagamento (Mercado Pago) — conforme seus termos de uso" />
          <Bullet text="Cumprimento de ordem judicial ou requisição de autoridades competentes" />
        </Section>

        <Section title="5. Direitos do usuário">
          <Para>Conforme a LGPD, você tem direito a:</Para>
          <Bullet text="Confirmar a existência de tratamento dos seus dados" />
          <Bullet text="Acessar seus dados pessoais armazenados" />
          <Bullet text="Corrigir dados incompletos, inexatos ou desatualizados" />
          <Bullet text="Solicitar a exclusão dos seus dados" />
          <Bullet text="Revogar o consentimento a qualquer momento" />
          <Bullet text="Portabilidade dos dados para outro serviço" />
        </Section>

        <Section title="6. Tempo de armazenamento">
          <Para>
            Dados cadastrais e documentos são mantidos por até 5 anos após o encerramento da conta,
            salvo obrigação legal que exija período maior. Após esse prazo, os dados são eliminados de forma segura.
          </Para>
        </Section>

        <Section title="7. Permissões do aplicativo">
          <Para>O aplicativo solicita as seguintes permissões, utilizadas exclusivamente para as finalidades indicadas:</Para>
          <Bullet text="Câmera — para captura de fotos de documentos e selfie" />
          <Bullet text="Armazenamento — para upload de arquivos de documentos" />
          <Bullet text="Localização — para calcular rotas e encontrar entregadores próximos" />
        </Section>

        <Section title="8. Contato e exercício de direitos">
          <Para>
            Para exercer seus direitos, fazer perguntas ou solicitar a exclusão dos seus dados, entre em contato:
          </Para>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            style={styles.emailBtn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="email" size={16} color={Colors.primary} />
            <Text style={styles.emailBtnText}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </Section>

        <Section title="9. Alterações nesta política">
          <Para>
            Esta política pode ser atualizada periodicamente. Em caso de alterações relevantes, você será
            notificado pelo aplicativo. O uso continuado do aplicativo após notificação implica a aceitação
            das alterações.
          </Para>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, gap: Spacing.md },
  updated: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  section: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: 4,
  },
  para: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary, marginTop: 8, flexShrink: 0,
  },
  bulletText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  emailBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  emailBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
