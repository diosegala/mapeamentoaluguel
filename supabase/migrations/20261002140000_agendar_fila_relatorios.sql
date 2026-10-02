-- Dispara a fila de relatórios a cada minuto; a função só chama o app quando há relatório pendente.
SELECT cron.schedule('fila-relatorios', '* * * * *', 'SELECT private.disparar_fila_relatorios()');
