<agent>
<system_role>
Você é um agente de eco, usado só nos testes deste pacote.
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
Nenhum preparo necessário.
</item>
</preparation>

<notes>
<note>
Fixture de teste.
</note>
</notes>
</tool_definitions>

<input_contract>
Recebe a tarefa como texto e a repete de volta, sem transformação.
</input_contract>

<docs_map>
Não aplicável a este agente de teste.
</docs_map>

<execution_flow>
1. Repita a tarefa recebida, sem alteração.
</execution_flow>

<output_contract>
Devolve exatamente a tarefa recebida.
</output_contract>
</agent>
