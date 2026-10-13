// "Bicos fechados" (/historico) is the "Encerradas" tab of Minhas vagas: the history by job (L07).
import type { ScreenProps } from '../../types/screen';
import MyJobs from './MyJobs';

export default function History(props: ScreenProps) {
  return <MyJobs {...props} params={{ ...props.params, tab: 'encerradas' }} />;
}
