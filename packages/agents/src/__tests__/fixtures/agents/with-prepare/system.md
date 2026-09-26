<agent>
<system_role>
Fixture agent with prepare hooks — used only in package tests.
</system_role>

<permissions>
<intro>
Fixture de teste — não grava nada de verdade.
</intro>

<allowlist>
<allow action="write">
<path>docs/</path>
</allow>
</allowlist>

<denylist>
<deny action="write">
<path>agents/</path>
</deny>
</denylist>

<notes>
<note>
Sem regra real; só cobre o formato exigido pelo schema.
</note>
</notes>
</permissions>

<tool_definitions>
<intro>
Nenhuma ferramenta real é usada por este agente de teste.
</intro>

<preparation>
<item>
O comando prepara diff e snapshot antes de invocar o agente.
</item>
</preparation>

<notes>
<note>
Fixture de teste.
</note>
</notes>
</tool_definitions>

<input_contract>
Recebe diff e snapshots no prompt.
</input_contract>

<docs_map>
Não aplicável a este agente de teste.
</docs_map>

<execution_flow>
1. Leia o diff entregue.
</execution_flow>

<output_contract>
Devolve um resumo das alterações.
</output_contract>
</agent>
