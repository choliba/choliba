<agent>
<system_role>
Você revisa código, usado só nos testes deste pacote.
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
Recebe um diff ou trecho de código pra revisar.
</input_contract>

<docs_map>
Não aplicável a este agente de teste.
</docs_map>

<execution_flow>
1. Revise o código recebido.
</execution_flow>

<output_contract>
Devolve comentários de revisão.
</output_contract>
</agent>
